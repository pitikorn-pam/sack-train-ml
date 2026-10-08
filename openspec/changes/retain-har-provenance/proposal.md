## Why

Compile evidence is lost when later stages fail or disposable calibration/runtime storage is cleaned. Retain future HAR stages and measured provenance without reconstructing the historical HEF or changing the compile recipe.

## What Changes

- Isolated compile attempts with successful-save stage journals and validated diagnostic ZIPs.
- Redacted logs, byte identities, actual calibration selection/preprocessing, requested/applied/unknown settings.
- Local retention, independent existing-uploader persistence and truthful external receipts on success and failure.
- One `compile_diagnostics` artifact kind, Models retrieval, local release bundle and notebook/CLI guidance.

## Capabilities

### New Capabilities

- `compile-diagnostics`: Retention, provenance and retrieval of future compile attempt evidence.

### Modified Capabilities

None.

## Impact

Python compile helpers/scripts, existing artifact contract consumers, Models artifact list and two notebooks. One stdlib-only module; no SDK calls added, no DB migration, storage service, registry history, precision/calibration/NMS policy change or deployment.
