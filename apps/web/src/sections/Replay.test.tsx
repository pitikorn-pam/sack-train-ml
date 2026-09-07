/**
 * The Replay instrument's pure logic — the parts that decide a number or refuse an
 * action, reachable without a backend and without a render.
 *
 * Tested through exports rather than through the DOM on purpose: a render test here
 * needs an explicit mocked labApi client, a mocked supabase session and per-test
 * cleanup, and the earlier attempt in this repo produced six failing tests that took
 * six seconds to say nothing. The engine's async paths belong to lib/labApi.test.ts,
 * which already owns them.
 *
 * `DEFAULT_CFG` is pinned against webui/lab_core.py the same way
 * sections/Lab.defaults.test.ts pins the old section's copy — that test goes when
 * Lab.tsx does, and this is what replaces it.
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_CFG, LETTERBOX_REFUSAL, artifactLabel, confidenceBinLabel, formatElapsed,
  frameRangeLabel, histogramBarPercent, jobProgressPercent, lineFromPoints, matchDistancePx,
  runDisabledReason, safeNumber, sourcePointFromClick, withAlpha, zoneRefusal,
} from "./Replay";

// Transcribed from webui/lab_core.py::LabConfig. If you change one side, this fails.
const BACKEND_DEFAULTS = {
  conf: 0.25,
  iou: 0.7,
  frame_stride: 2,
  device: "mps",
  tracker_type: "centroid",
  track_buffer: 30,
  match_thresh: 0.7,
  inflip: true,
  conf_split: 0.6,
  roi_dedup_px: 25,
  roi_dedup_frames: 120,
  count_cooldown_frames: 40,
} as const;

describe("Replay defaults agree with the backend", () => {
  for (const [key, value] of Object.entries(BACKEND_DEFAULTS)) {
    it(`${key} matches webui/lab_core.py`, () => {
      expect((DEFAULT_CFG as Record<string, unknown>)[key]).toBe(value);
    });
  }

  it("does not offer a tracker the backend cannot run", () => {
    expect(DEFAULT_CFG.tracker_type).not.toBe("bytetrack");
  });
});

/**
 * A 640×360 container showing a 1920×1080 source is a perfect fit — no bars — so the
 * cases that matter use a container the video cannot fill in one axis.
 */
describe("sourcePointFromClick maps a click through the letterbox", () => {
  const container = { left: 100, top: 50, width: 400, height: 400 };
  const source = { width: 1920, height: 1080 };
  // 400 wide at 16:9 renders 400×225, centred: 87.5px of bar above and below.
  const renderedTop = 50 + (400 - 225) / 2;

  it("maps the top-left corner of the rendered picture to source (0, 0)", () => {
    const mapped = sourcePointFromClick({ clientX: 100, clientY: renderedTop }, container, source);
    expect(mapped.point).toEqual([0, 0]);
  });

  it("maps the centre of the rendered picture to the centre of the source", () => {
    const mapped = sourcePointFromClick(
      { clientX: 100 + 200, clientY: renderedTop + 112.5 }, container, source,
    );
    expect(mapped.point).toEqual([960, 540]);
  });

  it("clamps the bottom-right corner inside the frame rather than one pixel past it", () => {
    const mapped = sourcePointFromClick(
      { clientX: 100 + 400, clientY: renderedTop + 225 }, container, source,
    );
    expect(mapped.point).toEqual([1919, 1079]);
  });

  it("refuses a click on the letterbox bar above the picture, with the reason", () => {
    const mapped = sourcePointFromClick({ clientX: 300, clientY: 60 }, container, source);
    expect(mapped.point).toBeUndefined();
    expect(mapped.refusal).toBe(LETTERBOX_REFUSAL);
  });

  it("refuses a click on the letterbox bar below the picture", () => {
    const mapped = sourcePointFromClick({ clientX: 300, clientY: 440 }, container, source);
    expect(mapped.refusal).toBe(LETTERBOX_REFUSAL);
  });

  it("refuses the bars on the sides when the container is the taller axis", () => {
    // 400 tall at 16:9 wants 711 wide; a 400×400 container is bar-free horizontally,
    // so use a wide container against a portrait source to get side bars.
    const portrait = { width: 1080, height: 1920 };
    const mapped = sourcePointFromClick({ clientX: 110, clientY: 250 }, container, portrait);
    expect(mapped.refusal).toBe(LETTERBOX_REFUSAL);
  });

  it("never returns a coordinate outside the source, whatever the click", () => {
    for (const clientX of [100, 250, 499.9]) {
      for (const clientY of [renderedTop, renderedTop + 100, renderedTop + 224.9]) {
        const mapped = sourcePointFromClick({ clientX, clientY }, container, source);
        expect(mapped.point).toBeDefined();
        const [x, y] = mapped.point!;
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(source.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(source.height);
      }
    }
  });
});

describe("geometry validation refuses rather than silently accepting", () => {
  it("refuses a polygon under three points, naming the minimum", () => {
    expect(zoneRefusal([])).toBe("Exclusion zone needs at least 3 points.");
    expect(zoneRefusal([[0, 0]])).toBe("Exclusion zone needs at least 3 points.");
    expect(zoneRefusal([[0, 0], [10, 10]])).toBe("Exclusion zone needs at least 3 points.");
  });

  it("accepts three points", () => {
    expect(zoneRefusal([[0, 0], [10, 0], [10, 10]])).toBeNull();
  });

  it("builds a line only from exactly two points, anchored to frame 0 in pixel space", () => {
    expect(lineFromPoints([[1, 2]], false)).toBeNull();
    expect(lineFromPoints([[1, 2], [3, 4], [5, 6]], false)).toBeNull();
    expect(lineFromPoints([[1, 2], [3, 4]], true)).toEqual({
      x1: 1, y1: 2, x2: 3, y2: 4, coordinate_space: "pixel", frame_ref: 0, inflip: true,
    });
  });

  it("carries inflip onto the line, so the flip cannot disagree with the config", () => {
    expect(lineFromPoints([[0, 0], [1, 1]], false)?.inflip).toBe(false);
  });
});

describe("runDisabledReason names the one thing that is missing", () => {
  const ready = { hasVideo: true, backendUp: true, modelReady: true, hasVideoSize: true };

  it("is empty when everything is ready", () => {
    expect(runDisabledReason(ready)).toBe("");
  });

  it("asks for a video first", () => {
    expect(runDisabledReason({ ...ready, hasVideo: false })).toBe("Add a source video to begin.");
  });

  it("names the backend before the model", () => {
    expect(runDisabledReason({ ...ready, backendUp: false, modelReady: false }))
      .toBe("Lab backend unavailable.");
  });

  it("treats an unanswered health check as not ready, not as ready", () => {
    expect(runDisabledReason({ ...ready, backendUp: null })).toBe("Lab backend unavailable.");
  });

  it("asks for a model, then for metadata", () => {
    expect(runDisabledReason({ ...ready, modelReady: false })).toBe("Select or upload a .pt model first.");
    expect(runDisabledReason({ ...ready, hasVideoSize: false })).toBe("Waiting for video metadata.");
  });
});

describe("matchDistancePx exposes what the dropped knob really did", () => {
  it("is inert at the shipped defaults — the ROI dedup radius wins", () => {
    const derived = matchDistancePx({ match_thresh: 0.7, roi_dedup_px: 25 });
    expect(derived.px).toBe(25);
    expect(derived.inert).toBe(true);
  });

  it("is inert across the whole plausible tuning range", () => {
    for (const thresh of [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]) {
      expect(matchDistancePx({ match_thresh: thresh, roi_dedup_px: 25 }).inert).toBe(true);
    }
  });

  it("starts having an effect below the crossover, and reports where that is", () => {
    const derived = matchDistancePx({ match_thresh: 0.7, roi_dedup_px: 25 });
    expect(derived.crossover).toBeCloseTo(0.5, 5);
    const active = matchDistancePx({ match_thresh: 0.3, roi_dedup_px: 25 });
    expect(active.inert).toBe(false);
    expect(active.px).toBeCloseTo(35, 5);
  });

  it("moves with the dedup radius, since that is the term that dominates", () => {
    // 50 * (1 - 0.7) is 15.000000000000002 in binary floating point — the reason the
    // backend formula is compared, never equated.
    expect(matchDistancePx({ match_thresh: 0.7, roi_dedup_px: 10 }).px).toBeCloseTo(15, 9);
    expect(matchDistancePx({ match_thresh: 0.7, roi_dedup_px: 10 }).inert).toBe(false);
  });
});

describe("the provenance strip's derived readouts", () => {
  it("always names the artifact kind, so a .pt number cannot be mistaken for a .hef one", () => {
    expect(artifactLabel("registry", { semver: "1.4.2" })).toBe("v1.4.2 · pt");
    expect(artifactLabel("local", { localName: "best.pt" })).toBe("best.pt · pt");
    expect(artifactLabel("legacy", { legacyPath: "/models/v5/best.pt" })).toBe("best.pt · pt");
  });

  it("says so when no artifact is selected, rather than showing an empty chip", () => {
    expect(artifactLabel("registry", {})).toBe("no artifact selected");
    expect(artifactLabel("local", { semver: "1.4.2" })).toBe("no artifact selected");
  });

  it("shows a frame range only when one is set, so a range always means 'not the whole clip'", () => {
    expect(frameRangeLabel({})).toBeNull();
    expect(frameRangeLabel({ frame_start: 0 })).toBeNull();
    expect(frameRangeLabel({ frame_start: 120 })).toBe("frames 120–end");
    expect(frameRangeLabel({ frame_end: 900 })).toBe("frames 0–900");
    expect(frameRangeLabel({ frame_start: 120, frame_end: 900 })).toBe("frames 120–900");
  });
});

describe("progress and histogram readouts stay inside their bounds", () => {
  it("normalises a fraction and a percentage to the same scale", () => {
    expect(jobProgressPercent(0.42)).toBeCloseTo(42, 5);
    expect(jobProgressPercent(42)).toBe(42);
  });

  it("clamps rather than drawing a bar past its own track", () => {
    expect(jobProgressPercent(140)).toBe(100);
    expect(jobProgressPercent(-3)).toBe(0);
  });

  it("returns null for a value the backend did not send, instead of zero", () => {
    expect(jobProgressPercent(undefined)).toBeNull();
    expect(jobProgressPercent(null)).toBeNull();
    expect(jobProgressPercent("80")).toBeNull();
    expect(jobProgressPercent(Number.NaN)).toBeNull();
  });

  it("scales a histogram bin against the largest bin", () => {
    expect(histogramBarPercent(5, 10)).toBe(50);
    expect(histogramBarPercent(10, 10)).toBe(100);
    expect(histogramBarPercent(0, 10)).toBe(0);
  });

  it("draws nothing rather than dividing by an empty histogram", () => {
    expect(histogramBarPercent(3, 0)).toBe(0);
    expect(histogramBarPercent(Number.NaN, 10)).toBe(0);
  });

  it("labels a bin with the backend's own edges", () => {
    expect(confidenceBinLabel({ lower: 0.25, upper: 0.5, count: 12 })).toBe("0.25–0.50");
  });

  it("renders a missing number as an em dash, never as 0.00", () => {
    expect(safeNumber(undefined)).toBe("—");
    expect(safeNumber(Number.NaN)).toBe("—");
    expect(safeNumber(0)).toBe("0.00");
  });

  it("formats elapsed as m:ss, and an unmeasured elapsed as an em dash", () => {
    expect(formatElapsed(null)).toBe("—");
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(9_000)).toBe("0:09");
    expect(formatElapsed(125_000)).toBe("2:05");
  });
});

describe("withAlpha keeps overlay fills on the token, not on a hard-coded hex", () => {
  it("turns a resolved 6-digit token into rgba at the requested alpha", () => {
    expect(withAlpha("#ef4444", 0.2)).toBe("rgba(239, 68, 68, 0.2)");
    expect(withAlpha("  #06b6d4  ", 0.12)).toBe("rgba(6, 182, 212, 0.12)");
  });

  it("passes anything it cannot parse through unchanged, so the overlay still draws", () => {
    expect(withAlpha("red", 0.2)).toBe("red");
    expect(withAlpha("rgb(1, 2, 3)", 0.2)).toBe("rgb(1, 2, 3)");
  });
});
