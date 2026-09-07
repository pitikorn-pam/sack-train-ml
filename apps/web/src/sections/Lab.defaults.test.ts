/**
 * The Lab's UI defaults must agree with the backend's, and a knob must not be able to
 * claim an effect it does not have.
 *
 * Two defects made this file necessary. `inflip` was `false` here and `True` in
 * webui/lab_core.py — and inflip swaps "in" for "out", so the button labelled "Reset
 * deployed defaults" restored a direction inversion. And the tracker dropdown offered
 * only "ByteTrack" while the backend unconditionally constructs a greedy centroid
 * tracker, which made the control a lie about what ran.
 *
 * The Python side is pinned by tests/test_lab_ground_truth.py. This pins the TypeScript
 * side. Both are a stopgap: the real fix is one config vocabulary owned by the shared
 * counting engine, which is build step 2 of the Experiment Lab map.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_CFG, matchDistancePx } from "./Lab";

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

describe("Lab defaults agree with the backend", () => {
  for (const [k, v] of Object.entries(BACKEND_DEFAULTS)) {
    it(`${k} matches webui/lab_core.py`, () => {
      expect((DEFAULT_CFG as Record<string, unknown>)[k]).toBe(v);
    });
  }

  it("does not offer a tracker the backend cannot run", () => {
    expect(DEFAULT_CFG.tracker_type).not.toBe("bytetrack");
  });
});

describe("matchDistancePx exposes what the knob really does", () => {
  it("is inert at the shipped defaults — the ROI dedup radius wins", () => {
    const d = matchDistancePx({ match_thresh: 0.7, roi_dedup_px: 25 });
    expect(d.px).toBe(25);
    expect(d.inert).toBe(true);
  });

  it("is inert across the whole plausible tuning range", () => {
    for (const t of [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]) {
      expect(matchDistancePx({ match_thresh: t, roi_dedup_px: 25 }).inert).toBe(true);
    }
  });

  it("starts having an effect below the crossover, and reports where that is", () => {
    const d = matchDistancePx({ match_thresh: 0.7, roi_dedup_px: 25 });
    expect(d.crossover).toBeCloseTo(0.5, 5);
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
