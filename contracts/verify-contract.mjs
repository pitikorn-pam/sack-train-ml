/**
 * Exercises the server-side validator that `start-training` depends on.
 *
 * The edge function is the authority — the only layer a client cannot bypass —
 * so the cost of a hole in it is a bad config reaching the database and a run
 * that fails 20 minutes into Colab. This runs the real `_shared/contract.ts`
 * against the real `param-schema.json`; no Deno needed, esbuild comes with Vite.
 *
 *   node contracts/verify-contract.mjs
 */
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");

// esbuild ships with the web app rather than at the repo root, so resolve it from there.
const require = createRequire(pathToFileURL(join(repo, "apps/web/package.json")));
const { build } = require("esbuild");

const bundled = await build({
  entryPoints: [join(repo, "supabase/functions/_shared/contract.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
  loader: { ".json": "json" },
});
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64")
);
const { validateConfig, resolveEffective, parseCheckpoint } = mod;

const good = {
  source_weights: "yolo11s.pt",
  dataset: "sack_dataset_sep/data.yaml",
  classes: ["person", "sack"],
  input_size: [640, 640, 3],
  hyperparameters: { epochs: 250, imgsz: 640, optimizer: "AdamW", batch: "auto" },
  compile_options: { compile_hef: true, optimization_level: "0", calib_n: 512 },
};

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures++;
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
};

console.log("\nparameter contract — server-side validator\n");

check("a well-formed config passes", () => {
  assert.deepEqual(validateConfig(good), []);
});

check("YOLO26 is refused, not merely cautioned", () => {
  const issues = validateConfig({ ...good, source_weights: "yolo26s.pt" });
  assert.ok(issues.some((i) => i.key === "source_weights"), "expected the checkpoint to be refused");
});

check("a pose checkpoint is refused (its branch is dropped in compile)", () => {
  const issues = validateConfig({ ...good, source_weights: "yolo11n-pose.pt" });
  assert.ok(issues.some((i) => i.key === "source_weights"));
});

check("single_cls is refused — it would train, deploy, and be wrong", () => {
  const issues = validateConfig({
    ...good,
    hyperparameters: { ...good.hyperparameters, single_cls: true },
  });
  assert.ok(issues.some((i) => i.key === "single_cls"));
});

check("optimization_level 2 with too few calibration images is refused", () => {
  const issues = validateConfig({
    ...good,
    compile_options: { ...good.compile_options, optimization_level: "2", calib_n: 512 },
  });
  assert.ok(issues.some((i) => i.key === "calib_n"));
});

check("optimization_level 2 with 1024 images passes", () => {
  const issues = validateConfig({
    ...good,
    compile_options: { ...good.compile_options, optimization_level: "2", calib_n: 1024 },
  });
  assert.deepEqual(issues, []);
});

check("a compile resolution that disagrees with training is refused", () => {
  const issues = validateConfig({
    ...good,
    input_size: [512, 512, 3],
    hyperparameters: { ...good.hyperparameters, imgsz: 640 },
  });
  assert.ok(issues.some((i) => i.key === "imgsz"));
});

check("out-of-range and non-multiple values are caught", () => {
  assert.ok(validateConfig({ ...good, hyperparameters: { ...good.hyperparameters, epochs: 0 } }).length);
  assert.ok(validateConfig({ ...good, hyperparameters: { ...good.hyperparameters, imgsz: 641 } }).length);
});

check("an unknown optimizer is caught before it reaches build_optimizer", () => {
  const issues = validateConfig({
    ...good,
    hyperparameters: { ...good.hyperparameters, optimizer: "adam2" },
  });
  assert.ok(issues.some((i) => i.key === "optimizer"));
});

check("resolveEffective marks a value nobody typed as a default", () => {
  const { values, sources } = resolveEffective("train", { epochs: 250 });
  assert.equal(values.optimizer, "AdamW", "optimizer should be filled in");
  assert.equal(sources.optimizer, "default", "and marked as a default — the Muon case");
  assert.equal(sources.epochs, "set");
});

check("checkpoint names parse to the right family and task", () => {
  assert.deepEqual(parseCheckpoint("yolo11s.pt"), { family: "yolo11", task: "detect" });
  assert.deepEqual(parseCheckpoint("yolo26m-seg.pt"), { family: "yolo26", task: "segment" });
  assert.deepEqual(parseCheckpoint("yolo11n-pose.pt"), { family: "yolo11", task: "pose" });
});

console.log(failures ? `\n${failures} failing\n` : "\nall passing\n");
process.exit(failures ? 1 : 0);
