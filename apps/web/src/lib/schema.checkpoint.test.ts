/**
 * checkpointName and parseCheckpoint are inverses, and the pair must stay that way —
 * "Re-create with same config" restores a form through the parse direction, and a
 * mismatch there silently hands the operator a different model than the run used.
 */
import { describe, it, expect } from "vitest";
import { checkpointName, parseCheckpoint, SIZES, schema } from "./schema";

describe("checkpoint naming round-trips", () => {
  const families = ["yolo11", "yolo26"];
  const tasks = Object.keys(schema.taskSuffix);

  it("every family × size × task survives the round trip", () => {
    for (const f of families) {
      for (const s of SIZES) {
        for (const t of tasks) {
          const name = checkpointName(f, s, t);
          const back = parseCheckpoint(name);
          expect({ family: back.family, size: back.size, task: back.task }).toEqual({
            family: f,
            size: s,
            task: t,
          });
          expect(back.exact).toBe(true);
        }
      }
    }
  });

  it("reports exact:false rather than substituting a default nobody chose", () => {
    const odd = parseCheckpoint("yolo11z.pt");
    expect(odd.exact).toBe(false);
  });

  it("survives a missing or malformed name without throwing", () => {
    expect(() => parseCheckpoint("")).not.toThrow();
    expect(parseCheckpoint("").exact).toBe(false);
  });
});
