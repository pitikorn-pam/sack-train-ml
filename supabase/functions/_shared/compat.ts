// =============================================================================
// _shared/compat.ts — Compat signature computation
// =============================================================================
// Computes SHA-256 of (class_names, input_size, output_kind, task) to detect
// breaking changes between versions on the same channel.
//
// Format MUST match Postgres compute_compat_signature() in migration 03.
// =============================================================================

export interface CompatInput {
  class_names: string[];
  input_size: number[] | number;
  output_kind: string;
  task: string;
}

/**
 * jsonb's own text form, which is what Postgres hashes.
 *
 * Two things about it are not obvious and both were got wrong here:
 *
 *  1. **jsonb does not preserve key order.** It stores keys sorted by length first,
 *     then bytewise — so this object serialises as task, input_size, class_names,
 *     output_kind, NOT alphabetically.
 *  2. **jsonb::text puts a space after every colon** as well as after every comma.
 *
 * The previous implementation ordered keys alphabetically and omitted the space after
 * the colon, so it disagreed with `public.compute_compat_signature()` on every input
 * ever tried — while carrying a comment saying it matched exactly. It has no caller, so
 * nothing broke; the moment anything used it, every model would have looked
 * incompatible with itself.
 */
function jsonbText(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return "[" + value.map(jsonbText).join(", ") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort((a, b) =>
    a.length !== b.length ? a.length - b.length : (a < b ? -1 : a > b ? 1 : 0)
  );
  return "{" + keys
    .map((k) => `${JSON.stringify(k)}: ${jsonbText((value as Record<string, unknown>)[k])}`)
    .join(", ") + "}";
}

export async function computeCompatSignature(input: CompatInput): Promise<string> {
  // Mirrors jsonb_build_object(...)::text in migration 03. Verified against the live
  // database by supabase/functions/_shared/compat_parity_test.ts, whose golden digests
  // were taken from Postgres itself rather than from this function.
  const canonical = jsonbText({
    class_names: input.class_names ?? [],
    input_size: input.input_size ?? [],
    output_kind: input.output_kind ?? "",
    task: input.task ?? "",
  });
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Exported for the parity test: the exact string Postgres hashes. */
export function compatCanonicalForm(input: CompatInput): string {
  return jsonbText({
    class_names: input.class_names ?? [],
    input_size: input.input_size ?? [],
    output_kind: input.output_kind ?? "",
    task: input.task ?? "",
  });
}
