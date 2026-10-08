## Context

The existing SDK child parses, saves native HAR, applies its generated script, loads sorted calibration images, optimizes, saves quantized HAR and compiles HEF. A later failure discarded diagnostics at wrapper boundaries; Colab reused deterministic filenames.

## Goals / Non-Goals

**Goals:** Retain successful stages and measured identities in isolated future attempts; distinguish compile result, archive readiness and persistence result; expose retrieval through existing artifacts.

**Non-Goals:** Historical reconstruction, new SDK stages, live compiler or storage validation, runtime deployment, precision/calibration/NMS policy changes, general storage abstractions.

## Decisions

- A stdlib `compile_diagnostics` module owns exclusive UUID directories, atomic JSON updates, incremental child stage journals, validated immutable ZIPs and external persistence receipts. The parent creates initial evidence before preflight/launch and alone finalizes after child exit.
- Journal `saved()` follows successful SDK save return and closed writes. File harvesting alone cannot prove a completed operation, especially after interrupted saves.
- Calibration records byte hashes of exactly the image bytes decoded, selected sorted path order/count and the unchanged RGB letterbox float32 0..255 preprocessing. Images/ONNX/PT and duplicate HEF bytes are excluded from ZIPs.
- Actual installed SDK version is observed in the child; missing version and SDK-internal adjusted settings remain explicit unknown. Exact generated script and applied status are separate from requested settings.
- Existing upload_artifact writes one new artifact kind with a UUID-bearing stem while version semver stays original. Diagnostic upload runs before/independently of HEF/meta uploads; failures preserve local evidence and fail the requested flow. Local release assembly receives this diagnostic even when upload failed.
- The actual run caller already passes `dataset_source`; `build_manifest` lacked that optional argument although ReleaseManifest already has the field. Add its pass-through so the diagnostic release path reaches local bundle/metadata assembly; mocked main tests first reproduced the TypeError.
- Colab uses the same helpers at mounted Drive WORK; each invocation resets HEF_PATH and verifies the exact new attempt output. Train notebook changes are Markdown only.

## Risks / Trade-offs

- [No real SDK/Drive/R2 exercised] → Keep reload/durability/live persistence UNVERIFIED until separately authorized.
- [Parent killed before finalization] → Stage journals and earlier saves survive; in_progress is not a ready archive. No claim of guaranteed archive creation after process/system termination.
- [Local disk or upload failure] → Retain attempt directory, surface retention/persistence errors alongside original compile failure; external receipt cannot manufacture an uploaded object.
- [Secret-bearing diagnostics] → Redact known client secrets and auth/token/signed URL forms; omit environment/command/auth dumps.
- [HAR disk usage] → No silent cleanup/overwrite; future retention quota policy requires its own scope.

## Migration Plan

Synchronize all existing artifact-kind consumers and their tests. No DB migration or SDK installation. Deployment/publication and any authorized SDK reload are subsequent gates, not part of this local change.

## Open Questions

Real SDK archive reload and Colab durable persistence must be verified later. Effective settings not exposed by a supported queried API remain unknown.
