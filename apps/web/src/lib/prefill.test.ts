import { describe, it, expect } from "vitest";
import { prefillFromConfig, emptyPrefill } from "./prefill";
import { checkpointName } from "./schema";

const CONFIG = {
  source_weights: "yolo11m.pt",
  dataset: "datasets/sack-v34/data.yaml",
  dataset_bundle: "datasets/sack-v34.zip",
  classes: ["person", "sack"],
  input_size: [960, 960, 3],
  task: "detection",
  run_name: "sack-2026-09-01",
  hyperparameters: { epochs: 250, lr0: 0.002, optimizer: "AdamW", mosaic: 0.7 },
  compile_options: { compile_hef: true, calib_n: 1024, optimization_level: "2" },
};

describe("prefillFromConfig", () => {
  it("restores the checkpoint the run actually used", () => {
    const p = prefillFromConfig(CONFIG);
    expect(checkpointName(p.family, p.size, p.task)).toBe("yolo11m.pt");
  });

  it("restores dataset, bundle and classes", () => {
    const p = prefillFromConfig(CONFIG);
    expect(p.datasetKey).toBe("datasets/sack-v34/data.yaml");
    expect(p.bundleKey).toBe("datasets/sack-v34.zip");
    expect(p.classes).toEqual(["person", "sack"]);
  });

  it("restores train fields, not just the defaults", () => {
    const p = prefillFromConfig(CONFIG);
    expect(p.values.epochs).toBe("250");
    expect(p.values.lr0).toBe("0.002");
  });

  it("takes imgsz from input_size, which is what the run really used", () => {
    expect(prefillFromConfig(CONFIG).values.imgsz).toBe("960");
  });

  it("restores compile fields and the compile toggle", () => {
    const p = prefillFromConfig(CONFIG);
    expect(p.compile).toBe(true);
    expect(p.values.calib_n).toBe("1024");
    expect(p.values.optimization_level).toBe("2");
  });

  it("puts hyperparameters with no control into the escape hatch instead of dropping them", () => {
    const p = prefillFromConfig(CONFIG);
    expect(JSON.parse(p.advanced)).toHaveProperty("mosaic", 0.7);
  });

  it("marks the run so a re-run is not mistaken for the original", () => {
    expect(prefillFromConfig(CONFIG).runName).toBe("sack-2026-09-01 (re-run)");
  });

  it("says what it could not restore rather than substituting silently", () => {
    const p = prefillFromConfig({ ...CONFIG, source_weights: "yolo11z.pt" });
    expect(p.notRestored.join(" ")).toMatch(/yolo11z/);
    expect(p.family).toBe(emptyPrefill().family);
  });

  it("does not throw on a null, empty or malformed config", () => {
    for (const bad of [null, undefined, {}, { hyperparameters: "nope" } as any]) {
      expect(() => prefillFromConfig(bad as any)).not.toThrow();
    }
  });

  it("turns compile off when the run did not compile", () => {
    const { compile_options, ...noCompile } = CONFIG;
    expect(prefillFromConfig(noCompile).compile).toBe(false);
  });
});
