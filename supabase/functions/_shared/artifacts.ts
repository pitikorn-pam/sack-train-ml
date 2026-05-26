// =============================================================================
// _shared/artifacts.ts — Artifact detail helpers
// =============================================================================
// Replaces seed-ml's model-metadata.ts. Operates on the artifacts JSONB column
// (Decision D2=B) instead of typed *_r2_key columns.
//
// artifacts shape on versions.artifacts:
//   {
//     "pytorch":  { "key": "runs/abc/v1.0.0.pt",        "size_bytes": 123, "sha256": "...", "quantization": {...} },
//     "onnx":     { "key": "runs/abc/v1.0.0.onnx",      "size_bytes": 123, "sha256": "..." },
//     "hef":      { "key": "runs/abc/v1.0.0.hef",       "size_bytes": 123, "sha256": "...", "quantization": {...} },
//     "hef_meta": { "key": "runs/abc/v1.0.0.hef.meta",  "size_bytes": 123, "sha256": "..." }
//   }
//
// Supported artifact kinds for BSCP Phase 1: pytorch, onnx, hef, hef_meta.
// Adding a new kind = just write the row with that key; no code change needed.
// =============================================================================

export type ArtifactKind = "pytorch" | "onnx" | "hef" | "hef_meta";

export const ARTIFACT_EXTENSIONS: Record<ArtifactKind, string> = {
  pytorch: "pt",
  onnx: "onnx",
  hef: "hef",
  hef_meta: "hef.meta.yaml",
};

export const ARTIFACT_CONTENT_TYPES: Record<ArtifactKind, string> = {
  pytorch: "application/octet-stream",
  onnx: "application/octet-stream",
  hef: "application/octet-stream",
  hef_meta: "application/x-yaml",
};

export type ArtifactDetail = {
  kind: ArtifactKind;
  r2_key: string | null;
  size_bytes: number | null;
  content_hash: string | null;
  quantization: Record<string, unknown> | null;
};

export function artifactDetail(
  artifacts: unknown,
  kind: ArtifactKind,
): ArtifactDetail {
  const all = recordOrNull(artifacts);
  const a = recordOrNull(all?.[kind]);
  return {
    kind,
    r2_key: stringOrNull(a?.key),
    size_bytes: numberOrNull(a?.size_bytes),
    content_hash: stringOrNull(a?.sha256),
    quantization: recordOrNull(a?.quantization),
  };
}

export function listArtifactKinds(artifacts: unknown): ArtifactKind[] {
  const all = recordOrNull(artifacts);
  if (!all) return [];
  return Object.keys(all).filter((k): k is ArtifactKind =>
    (Object.keys(ARTIFACT_EXTENSIONS) as string[]).includes(k),
  );
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
