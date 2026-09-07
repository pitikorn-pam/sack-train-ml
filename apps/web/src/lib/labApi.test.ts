/**
 * Comparison is the product's actual verb, and this is the only place it happens today.
 *
 * Everything the Experiment Lab plans to build — baseline vs candidate over a clip set,
 * the two mandatory refusals, the delta table — starts from this function. It had no
 * test, and it silently omitted `dropped` from its deltas: a change that moves crossings
 * between dropped and confirmed showed up in `total` with no line explaining it.
 */
import { describe, it, expect } from "vitest";
import { compareRunManifests, manifestConfig, replayConfigFromManifest } from "./labApi";
import type { RunManifest } from "./labApi";

const record = (over: Record<string, unknown> = {}) => ({
  event_id: "crossing-000001",
  frame_index: 100,
  track_id: 7,
  direction: "in",
  status: "confirmed",
  recovery: "none",
  detection_conf: 0.9,
  decision: { raw_conf: 0.9, exclusion_hit: false },
  ...over,
});

const manifest = (over: Partial<RunManifest> = {}): RunManifest =>
  ({
    schema_version: "1.0",
    run_id: "run-a",
    created_at: "2026-09-07T00:00:00Z",
    config: { conf: 0.25, match_thresh: 0.7 },
    counts: {
      summary: { confirmed: 10, flagged: 2, dropped: 1, recovered: 0, excluded: 0, total: 13 },
      events: { event_records: [record()] },
    },
    ...over,
  }) as unknown as RunManifest;

describe("compareRunManifests", () => {
  it("names both sides", () => {
    const c = compareRunManifests(manifest({ run_id: "base" }), manifest({ run_id: "cand" }));
    expect(c.baselineId).toBe("base");
    expect(c.currentId).toBe("cand");
  });

  it("reports a delta for dropped, which used to be silently omitted", () => {
    const base = manifest();
    const cand = manifest({
      counts: { summary: { confirmed: 11, flagged: 2, dropped: 0, recovered: 0, excluded: 0, total: 13 },
                events: { event_records: [record()] } },
    } as Partial<RunManifest>);
    const keys = compareRunManifests(base, cand).metricDeltas.map((m) => m.key);
    expect(keys).toContain("dropped");
    const dropped = compareRunManifests(base, cand).metricDeltas.find((m) => m.key === "dropped")!;
    expect(dropped.delta).toBe(-1);
    expect(dropped.baseline).toBe(1);
    expect(dropped.current).toBe(0);
  });

  it("never renders a delta without both absolute values", () => {
    const c = compareRunManifests(manifest(), manifest());
    for (const m of c.metricDeltas) {
      expect(typeof m.baseline).toBe("number");
      expect(typeof m.current).toBe("number");
      expect(m.delta).toBe(m.current - m.baseline);
    }
  });

  it("omits a metric one side does not have rather than treating it as zero", () => {
    const partial = manifest({
      counts: { summary: { confirmed: 10, total: 10 }, events: { event_records: [] } },
    } as Partial<RunManifest>);
    const keys = compareRunManifests(manifest(), partial).metricDeltas.map((m) => m.key);
    expect(keys).not.toContain("flagged");
    expect(keys).toContain("confirmed");
  });

  it("lists changed config keys, sorted, and nothing else", () => {
    const base = manifest({ config: { conf: 0.25, match_thresh: 0.7 } } as Partial<RunManifest>);
    const cand = manifest({ config: { conf: 0.30, match_thresh: 0.7, inflip: true } } as Partial<RunManifest>);
    expect(compareRunManifests(base, cand).changedConfigKeys).toEqual(["conf", "inflip"]);
  });

  it("locks the event diff when either side has no records, rather than inventing one", () => {
    const noRecords = manifest({ counts: { summary: { confirmed: 1, total: 1 } } } as Partial<RunManifest>);
    expect(compareRunManifests(manifest(), noRecords).eventDiff.locked).toBe(true);
  });

  it("finds added and removed events by id", () => {
    const base = manifest();
    const cand = manifest({
      counts: { summary: { confirmed: 10, flagged: 2, dropped: 1, recovered: 0, excluded: 0, total: 13 },
                events: { event_records: [record({ event_id: "crossing-000002" })] } },
    } as Partial<RunManifest>);
    const diff = compareRunManifests(base, cand).eventDiff;
    expect(diff.addedIds).toEqual(["crossing-000002"]);
    expect(diff.removedIds).toEqual(["crossing-000001"]);
  });

  it("reports a changed field on a surviving event, naming the field", () => {
    const cand = manifest({
      counts: { summary: { confirmed: 10, flagged: 2, dropped: 1, recovered: 0, excluded: 0, total: 13 },
                events: { event_records: [record({ status: "flagged" })] } },
    } as Partial<RunManifest>);
    const diff = compareRunManifests(manifest(), cand).eventDiff;
    expect(diff.changedRecords).toHaveLength(1);
    expect(diff.changedRecords[0].changedFields).toContain("status");
  });

  it("reaches into decision provenance for changes", () => {
    const cand = manifest({
      counts: { summary: { confirmed: 10, flagged: 2, dropped: 1, recovered: 0, excluded: 0, total: 13 },
                events: { event_records: [record({ decision: { raw_conf: 0.4, exclusion_hit: false } })] } },
    } as Partial<RunManifest>);
    const fields = compareRunManifests(manifest(), cand).eventDiff.changedRecords[0].changedFields;
    expect(fields).toContain("decision.raw_conf");
  });

  it("reports no differences for identical manifests", () => {
    const diff = compareRunManifests(manifest(), manifest()).eventDiff;
    expect(diff.addedIds).toEqual([]);
    expect(diff.removedIds).toEqual([]);
    expect(diff.changedRecords).toEqual([]);
  });
});

describe("config from a manifest", () => {
  it("prefers the backend's own snapshot over the loose config", () => {
    const m = manifest({ config_snapshot: { conf: 0.9 } } as Partial<RunManifest>);
    expect(manifestConfig(m).conf).toBe(0.9);
  });

  it("never carries a model path back into the editor", () => {
    const m = manifest({ config: { conf: 0.3, model_path: "/tmp/best.pt" } } as Partial<RunManifest>);
    expect(replayConfigFromManifest(m)).not.toHaveProperty("model_path");
    expect(replayConfigFromManifest(m).conf).toBe(0.3);
  });

  it("drops keys that are not replay config", () => {
    const m = manifest({ config: { conf: 0.3, something_else: 1 } } as Partial<RunManifest>);
    expect(replayConfigFromManifest(m)).not.toHaveProperty("something_else");
  });
});
