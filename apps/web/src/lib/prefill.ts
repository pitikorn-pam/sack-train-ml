/**
 * Turn a stored run config back into the New-run form's state.
 *
 * "Re-create with same config" used to be a promise the wiring did not keep: the
 * button handed the config to a zero-argument callback that threw it away and opened
 * a blank form. Restoring it needs a real mapping, and the mapping needs to be honest
 * about what it could not restore — a form silently pre-filled with defaults is worse
 * than a blank one, because it looks like the previous run.
 */
import { schema, paramsFor, parseCheckpoint, SIZES } from "./schema";

export type Prefill = {
  family: string;
  size: string;
  task: string;
  runName: string;
  datasetKey: string;
  bundleKey: string | null;
  classes: string[];
  values: Record<string, string>;
  advanced: string;
  compile: boolean;
  /** What the config asked for that this form cannot express. Shown to the operator. */
  notRestored: string[];
};

const FIELD_DEFAULTS = (): Record<string, string> =>
  Object.fromEntries(
    schema.params
      .filter((p) => p.category === "field")
      .map((p) => [p.key, String(p.default ?? "")]),
  );

export function emptyPrefill(): Prefill {
  return {
    family: "yolo11",
    size: "s",
    task: "detect",
    runName: `sack-${new Date().toISOString().slice(0, 10)}`,
    datasetKey: "",
    bundleKey: null,
    classes: ["person", "sack"],
    values: FIELD_DEFAULTS(),
    advanced: "{}",
    compile: true,
    notRestored: [],
  };
}

export function prefillFromConfig(config: Record<string, unknown> | null | undefined): Prefill {
  const base = emptyPrefill();
  if (!config || typeof config !== "object") return base;

  const notRestored: string[] = [];
  const weights = typeof config.source_weights === "string" ? config.source_weights : "";
  const ck = parseCheckpoint(weights);
  if (weights && !ck.exact) {
    notRestored.push(`checkpoint "${weights}" is not one this build offers — reset to yolo11s`);
  }

  const hp = (config.hyperparameters ?? {}) as Record<string, unknown>;
  const co = (config.compile_options ?? {}) as Record<string, unknown>;
  const fieldKeys = new Set(schema.params.filter((p) => p.category === "field").map((p) => p.key));

  const values = FIELD_DEFAULTS();
  for (const [k, v] of Object.entries({ ...hp, ...co })) {
    if (k === "compile_hef") continue;
    if (fieldKeys.has(k)) values[k] = String(v);
  }

  // input_size is the authority on imgsz: the run recorded what it actually used,
  // and hyperparameters.imgsz can legitimately be absent.
  const size3 = config.input_size;
  if (Array.isArray(size3) && typeof size3[0] === "number") values.imgsz = String(size3[0]);

  // Anything the run set that the form has no control for belongs in the escape
  // hatch, visibly, rather than being dropped on the floor.
  const extra = Object.fromEntries(
    Object.entries(hp).filter(([k]) => !fieldKeys.has(k)),
  );

  // A refused parameter cannot be resubmitted, so say so instead of carrying it.
  const refusedKeys = new Set(schema.params.filter((p) => p.category === "refused").map((p) => p.key));
  for (const k of Object.keys({ ...hp, ...co })) {
    if (refusedKeys.has(k)) {
      notRestored.push(`${k} is refused by the current contract and was dropped`);
      delete (extra as Record<string, unknown>)[k];
    }
  }

  const classes = Array.isArray(config.classes) && config.classes.every((c) => typeof c === "string")
    ? (config.classes as string[])
    : base.classes;

  const rawName = typeof config.run_name === "string" && config.run_name ? config.run_name : base.runName;

  return {
    family: ck.exact ? ck.family : base.family,
    size: ck.exact && (SIZES as readonly string[]).includes(ck.size) ? ck.size : base.size,
    task: ck.exact ? ck.task : base.task,
    runName: `${rawName} (re-run)`,
    datasetKey: typeof config.dataset === "string" ? config.dataset : "",
    bundleKey: typeof config.dataset_bundle === "string" ? config.dataset_bundle : null,
    classes,
    values,
    advanced: Object.keys(extra).length ? JSON.stringify(extra, null, 2) : "{}",
    compile: co.compile_hef === true,
    notRestored,
  };
}

/** Every train field the form offers, for tests and for the summary panel. */
export const trainFieldKeys = () => paramsFor("train", "field").map((p) => p.key);
