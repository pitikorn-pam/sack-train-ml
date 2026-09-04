/**
 * Parameter contract — the browser's reader for `paramSchema.json`.
 *
 * The schema is the single source of truth shared with the `start-training`
 * edge function and the Python pipeline (see .scratch/train-param-contract/issues/05).
 * The browser mirrors validation for instant feedback; the edge function is the
 * authority and the only place that can guarantee nothing invalid reaches the
 * database (issue 04).
 */
import raw from "./paramSchema.json";

export type Category = "field" | "advanced" | "derived" | "refused";
export type Level = "ok" | "warn" | "blocked";
/** Where a value in the effective config came from. */
export type Source = "set" | "default" | "derived";

export interface Param {
  key: string;
  form: "train" | "compile";
  category: Category;
  label: string;
  help: string;
  type?: "int" | "float" | "enum" | "text";
  default?: string | number;
  enum?: string[];
  discouraged?: string[];
  min?: number;
  max?: number;
  step?: number;
  derivedFrom?: string;
}

export interface Capability {
  level: Level;
  profile: string;
  title: string;
  text: string;
  status: string;
}

export const schema = raw as unknown as {
  toolchain: Record<string, string>;
  families: Record<
    string,
    {
      label: string;
      docs: string;
      tasks: string[];
      metrics: Record<string, Record<string, { params: string; map: string; e2e?: string; flops: string }>>;
    }
  >;
  taskLabels: Record<string, string>;
  taskSuffix: Record<string, string>;
  sizeLabels: Record<string, string>;
  capability: { when: { family?: string; task?: string[] }; level: Level; profile: string; title: string; text: string; status: string }[];
  params: Param[];
};

export const SIZES = ["n", "s", "m", "l", "x"] as const;

export const paramsFor = (form: "train" | "compile", category?: Category) =>
  schema.params.filter((p) => p.form === form && (!category || p.category === category));

export const byKey = (key: string) => schema.params.find((p) => p.key === key);

export function checkpointName(family: string, size: string, task: string) {
  return `${family}${size}${schema.taskSuffix[task] ?? ""}.pt`;
}

/** First matching capability rule wins; the last rule has an empty `when` and always matches. */
export function capabilityFor(family: string, task: string): Capability {
  const hit = schema.capability.find(
    (c) =>
      (c.when.family === undefined || c.when.family === family) &&
      (c.when.task === undefined || c.when.task.includes(task)),
  )!;
  const status = c_status(hit, task);
  return { level: hit.level, profile: hit.profile, title: hit.title, text: hit.text, status };
}
function c_status(c: { when: { task?: string[] }; status: string }, task: string) {
  // the pose/obb rule reads "<task> loses its extra branch in compile"
  return c.when.task && c.when.task.length > 1 && c.status.startsWith("loses")
    ? `${schema.taskLabels[task]} ${c.status}`
    : c.status;
}

/**
 * Resolve the values the form holds into an effective config, tagging where each
 * value came from. Only *our* defaults resolve here — ultralytics fills roughly a
 * hundred more keys that are knowable only inside the run, which is why the run
 * records the final layer itself (issue 07).
 */
export function resolveEffective(
  form: "train" | "compile",
  values: Record<string, string>,
  derived: Record<string, string>,
): { key: string; value: string; source: Source }[] {
  return paramsFor(form)
    .filter((p) => p.category !== "refused")
    .map((p) => {
      if (p.category === "derived") return { key: p.key, value: derived[p.key] ?? "—", source: "derived" as Source };
      const def = String(p.default ?? "");
      const value = values[p.key] ?? def;
      return { key: p.key, value, source: (value === def ? "default" : "set") as Source };
    });
}

export interface Issue {
  key: string;
  level: "blocking" | "warning";
  message: string;
}

/** Static validation — mirrors what the edge function enforces. */
export function validate(values: Record<string, string>, capability: Capability): Issue[] {
  const issues: Issue[] = [];

  if (capability.level === "blocked")
    issues.push({ key: "model", level: "blocking", message: capability.title });

  for (const p of schema.params) {
    if (p.category !== "field") continue;
    const v = values[p.key];
    if (v === undefined || v === "") continue;

    if (p.type === "int" || p.type === "float") {
      const n = Number(v);
      if (!Number.isFinite(n)) {
        issues.push({ key: p.key, level: "blocking", message: `${p.label} must be a number.` });
        continue;
      }
      if (p.type === "int" && !Number.isInteger(n))
        issues.push({ key: p.key, level: "blocking", message: `${p.label} must be a whole number.` });
      if (p.min !== undefined && n < p.min)
        issues.push({ key: p.key, level: "blocking", message: `${p.label} must be at least ${p.min}.` });
      if (p.max !== undefined && n > p.max)
        issues.push({ key: p.key, level: "blocking", message: `${p.label} must be at most ${p.max}.` });
      if (p.step && n % p.step !== 0)
        issues.push({ key: p.key, level: "blocking", message: `${p.label} must be a multiple of ${p.step}.` });
    }
    if (p.enum && !p.enum.includes(v))
      issues.push({ key: p.key, level: "blocking", message: `${p.label} must be one of ${p.enum.join(", ")}.` });
    if (p.discouraged?.includes(v))
      issues.push({ key: p.key, level: "warning", message: `${p.label} = ${v} is not recommended.` });
  }

  // cross-field rules — where the real damage lives
  if (values.optimization_level === "2" && Number(values.calib_n ?? 512) < 1024)
    issues.push({
      key: "calib_n",
      level: "blocking",
      message: "Optimization level 2 fine-tunes over 1024 images — raise the calibration count or drop to level 0.",
    });
  if (Number(values.fraction ?? 1) < 1)
    issues.push({
      key: "fraction",
      level: "warning",
      message: `This run would train on ${Math.round(Number(values.fraction) * 100)}% of the dataset.`,
    });
  if (values.calibration_set === "train-split" && values.optimization_level === "2")
    issues.push({
      key: "calibration_set",
      level: "warning",
      message: "Level 2 calibrates against these images — training-split frames prove the pipeline, not the accuracy.",
    });

  return issues;
}
