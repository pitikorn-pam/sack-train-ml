/**
 * The activity stream is the Overview tab's entire content.
 *
 * Its ids are load-bearing: they key the "read" set in localStorage, so an id that
 * changes for the same event marks it unread again, and an id that does NOT change when
 * the event does hides the new state behind an old read mark.
 */
import { describe, it, expect } from "vitest";
import { deriveActivities } from "./activity";

const run = (over: Record<string, unknown> = {}) =>
  ({
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    status: "succeeded",
    created_at: "2026-09-01T00:00:00Z",
    finished_at: "2026-09-01T01:00:00Z",
    ...over,
  }) as never;

const version = (over = {}) =>
  ({ id: "v1", semver: "1.0.0-abc", created_at: "2026-09-02T00:00:00Z", ...over }) as never;

const deployment = (over = {}) =>
  ({
    id: "d1", channel_name: "stable", version_id: "11111111-2222-3333-4444-555555555555",
    status: "active", is_default: false, deployed_at: "2026-09-03T00:00:00Z", ...over,
  }) as never;

const derive = (o: Partial<Parameters<typeof deriveActivities>[0]> = {}) =>
  deriveActivities({ runs: [], versions: [], deployments: [], ...o });

describe("run entries", () => {
  it("maps each terminal status to its own tone and title", () => {
    const items = derive({
      runs: [run({ id: "r1", status: "running" }), run({ id: "r2", status: "succeeded" }),
             run({ id: "r3", status: "failed" }), run({ id: "r4", status: "cancelled" })],
    });
    const byTitle = Object.fromEntries(items.map((i) => [i.title, i.tone]));
    expect(byTitle["Training running"]).toBe("info");
    expect(byTitle["Training finished"]).toBe("success");
    expect(byTitle["Training failed"]).toBe("danger");
    expect(byTitle["Training cancelled"]).toBe("muted");
  });

  it("skips pending runs — a run that has not started is not activity", () => {
    expect(derive({ runs: [run({ status: "pending" })] })).toHaveLength(0);
  });

  it("a failed run shows the last error from its log rather than the status word", () => {
    const items = derive({
      runs: [run({
        status: "failed",
        config_yaml: { logs: [
          { status: "info", message: "starting" },
          { status: "error", message: "first failure" },
          { status: "error", message: "HEF compile was requested and failed" },
        ] },
      })],
    });
    expect(items[0].detail).toBe("HEF compile was requested and failed");
  });

  it("a failed run with no error log still says something useful", () => {
    const items = derive({ runs: [run({ status: "failed" })] });
    expect(items[0].detail).toContain("failed");
  });

  it("a very long error is truncated rather than breaking the layout", () => {
    const items = derive({
      runs: [run({ status: "failed", config_yaml: { logs: [{ status: "error", message: "x".repeat(500) }] } })],
    });
    expect(items[0].detail.length).toBeLessThanOrEqual(120);
  });
});

describe("ids are stable per state, and change when the state does", () => {
  it("the same run in the same state yields the same id", () => {
    expect(derive({ runs: [run()] })[0].id).toBe(derive({ runs: [run()] })[0].id);
  });

  it("a run that moved on gets a new id, so it surfaces as unread again", () => {
    const a = derive({ runs: [run({ status: "running" })] })[0].id;
    const b = derive({ runs: [run({ status: "succeeded" })] })[0].id;
    expect(a).not.toBe(b);
  });

  it("a deployment that becomes the default gets a new id", () => {
    const a = derive({ deployments: [deployment({ is_default: false })] })[0].id;
    const b = derive({ deployments: [deployment({ is_default: true })] })[0].id;
    expect(a).not.toBe(b);
  });
});

describe("deployments", () => {
  it("distinguishes deployed, default and undeployed", () => {
    const items = derive({
      deployments: [
        deployment({ id: "d1", is_default: false }),
        deployment({ id: "d2", is_default: true }),
        deployment({ id: "d3", status: "archived" }),
      ],
    });
    const titles = items.map((i) => i.title);
    expect(titles).toContain("Deployed to stable");
    expect(titles).toContain("Default on stable");
    expect(titles).toContain("Undeployed from stable");
  });
});

describe("ordering and bounds", () => {
  it("is newest first across all three sources", () => {
    const items = derive({ runs: [run()], versions: [version()], deployments: [deployment()] });
    expect(items.map((i) => i.ts)).toEqual([...items.map((i) => i.ts)].sort().reverse());
  });

  it("is capped, so a busy day cannot render an unbounded list", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      version({ id: `v${i}`, created_at: `2026-09-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z` }));
    expect(derive({ versions: many }).length).toBeLessThanOrEqual(24);
  });

  it("no sources means an empty stream, not a placeholder", () => {
    expect(derive()).toEqual([]);
  });
});
