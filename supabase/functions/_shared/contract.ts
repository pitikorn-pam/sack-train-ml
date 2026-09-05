// =============================================================================
// contract.ts — server-side validation against the shared parameter schema
// =============================================================================
// The browser mirrors these checks for instant feedback, but this is the
// authority: `start-training` is the choke point every run passes through, so it
// is the only place that can guarantee nothing invalid reaches the database.
// A stale tab, a script, or any other client must not be able to slip past.
//
// It reads the SAME file the web app and the Python pipeline read — importing
// it, not copying it, because a copy is what drifts (issue 05).
//
// This layer does STATIC validation only: does the key exist, is the value in
// range, do the cross-field rules hold. Whether the *installed* ultralytics
// accepts a value, whether the checkpoint downloads, whether a GPU exists for
// optimization_level 2 — those need the real environment and belong to Python at
// run start (issue 04).
// =============================================================================

import schema from "../../../contracts/param-schema.json" with { type: "json" };

export type Category = "field" | "advanced" | "derived" | "refused";
export type Level = "ok" | "warn" | "blocked";
export type Source = "set" | "default" | "derived";

interface Param {
  key: string;
  form: "train" | "compile";
  category: Category;
  label: string;
  type?: string;
  default?: string | number;
  enum?: string[];
  min?: number;
  max?: number;
  step?: number;
}

interface CapabilityRule {
  when: { family?: string; task?: string[] };
  level: Level;
  profile: string;
  title: string;
}

const params = schema.params as unknown as Param[];
const rules = schema.capability as unknown as CapabilityRule[];

export interface Issue {
  key: string;
  message: string;
}

const paramsFor = (form: "train" | "compile", category?: Category) =>
  params.filter((p) => p.form === form && (!category || p.category === category));

/** Which family/task a checkpoint name implies, e.g. "yolo11s-seg.pt". */
export function parseCheckpoint(weights: string): { family: string; task: string } {
  const stem = weights.replace(/\.pt$/, "");
  const family = stem.startsWith("yolo26") ? "yolo26" : "yolo11";
  const suffixes = schema.taskSuffix as unknown as Record<string, string>;
  let task = "detect";
  for (const [t, sfx] of Object.entries(suffixes)) {
    if (sfx && stem.endsWith(sfx)) task = t;
  }
  return { family, task };
}

export function capabilityFor(family: string, task: string): CapabilityRule {
  return rules.find(
    (c) =>
      (c.when.family === undefined || c.when.family === family) &&
      (c.when.task === undefined || c.when.task.includes(task)),
  )!;
}

/**
 * Resolve OUR layer of defaults. Ultralytics fills roughly a hundred more keys
 * that are knowable only where it is installed, so the run records the final
 * layer itself — this resolves what a server honestly can (issue 07).
 */
export function resolveEffective(
  form: "train" | "compile",
  supplied: Record<string, unknown>,
): { values: Record<string, unknown>; sources: Record<string, Source> } {
  const values: Record<string, unknown> = {};
  const sources: Record<string, Source> = {};
  for (const p of paramsFor(form)) {
    if (p.category === "derived" || p.category === "refused") continue;
    if (Object.prototype.hasOwnProperty.call(supplied, p.key)) {
      values[p.key] = supplied[p.key];
      sources[p.key] = String(supplied[p.key]) === String(p.default) ? "default" : "set";
    } else {
      values[p.key] = p.default ?? null;
      sources[p.key] = "default";
    }
  }
  return { values, sources };
}

/** Everything that must be true before a run may exist. */
export function validateConfig(config: Record<string, unknown>): Issue[] {
  const issues: Issue[] = [];

  const weights = String(config.source_weights ?? "");
  if (!weights) issues.push({ key: "source_weights", message: "source_weights is required." });
  if (!config.dataset) issues.push({ key: "dataset", message: "dataset is required." });
  const classes = config.classes;
  if (!Array.isArray(classes) || classes.length === 0)
    issues.push({ key: "classes", message: "classes must be a non-empty list." });

  // A path this project knows is broken must be refused, not cautioned: those
  // compile successfully and then count zero on the device.
  if (weights) {
    const { family, task } = parseCheckpoint(weights);
    const cap = capabilityFor(family, task);
    if (cap.level === "blocked")
      issues.push({ key: "source_weights", message: `${weights}: ${cap.title}` });
  }

  const hp = (config.hyperparameters ?? {}) as Record<string, unknown>;
  const co = (config.compile_options ?? {}) as Record<string, unknown>;

  for (const [form, supplied] of [["train", hp], ["compile", co]] as const) {
    for (const p of paramsFor(form, "refused")) {
      if (Object.prototype.hasOwnProperty.call(supplied, p.key))
        issues.push({ key: p.key, message: `${p.label} is refused by the parameter contract.` });
    }
    for (const p of paramsFor(form, "field")) {
      if (!Object.prototype.hasOwnProperty.call(supplied, p.key)) continue;
      const raw = supplied[p.key];
      if (raw === null || raw === undefined) continue;
      const v = String(raw);

      if (p.type === "int" || p.type === "float") {
        const n = Number(v);
        if (!Number.isFinite(n)) {
          issues.push({ key: p.key, message: `${p.label} must be a number, got ${JSON.stringify(raw)}.` });
          continue;
        }
        if (p.type === "int" && !Number.isInteger(n))
          issues.push({ key: p.key, message: `${p.label} must be a whole number.` });
        if (p.min !== undefined && n < p.min)
          issues.push({ key: p.key, message: `${p.label} must be at least ${p.min}.` });
        if (p.max !== undefined && n > p.max)
          issues.push({ key: p.key, message: `${p.label} must be at most ${p.max}.` });
        if (p.step && n % p.step !== 0)
          issues.push({ key: p.key, message: `${p.label} must be a multiple of ${p.step}.` });
      }
      if (p.enum && !p.enum.includes(v))
        issues.push({ key: p.key, message: `${p.label} must be one of ${p.enum.join(", ")}, got ${JSON.stringify(raw)}.` });
    }
  }

  // Cross-field rules — where the real damage lives.
  if (String(co.optimization_level ?? "0") === "2" && Number(co.calib_n ?? 512) < 1024)
    issues.push({
      key: "calib_n",
      message: "optimization_level 2 fine-tunes over 1024 images — raise calib_n or drop to level 0.",
    });

  // The compile inherits the training resolution; they can never disagree.
  const inputSize = Array.isArray(config.input_size) ? Number(config.input_size[0]) : undefined;
  const imgsz = hp.imgsz !== undefined ? Number(hp.imgsz) : undefined;
  if (inputSize !== undefined && imgsz !== undefined && inputSize !== imgsz)
    issues.push({
      key: "imgsz",
      message: `input_size ${inputSize} disagrees with imgsz ${imgsz} — a compile inherits its source run's resolution.`,
    });

  return issues;
}

export const contractVersion = () =>
  (schema as unknown as { toolchain: Record<string, string> }).toolchain;
