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

export async function computeCompatSignature(input: CompatInput): Promise<string> {
  // Postgres to_jsonb serializes arrays with a space after each comma.
  // Match exactly to keep client-side and DB-side signatures aligned.
  const classNamesJson =
    "[" + input.class_names.map((s) => JSON.stringify(s)).join(", ") + "]";

  const inputSizeJson = Array.isArray(input.input_size)
    ? "[" + input.input_size.join(", ") + "]"
    : String(input.input_size);

  const canonical =
    `{"class_names":${classNamesJson}` +
    `,"input_size":${inputSizeJson}` +
    `,"output_kind":${JSON.stringify(input.output_kind)}` +
    `,"task":${JSON.stringify(input.task)}}`;
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
