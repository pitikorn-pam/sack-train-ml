# HAR compile diagnostics retention

Future compile invocations retain evidence under `<out-dir>/compile-attempts/<uuid>/`.
This prevents future evidence loss; it does not recover historical HAR files or reconstruct the historical HEF.
The compile recipe, precision, calibration selection, optimization default and NMS thresholds are unchanged.

## What is retained

The parent creates an exclusive attempt and `manifest.json` before compiler preflight/launch.
The SDK child records native/parsed HAR after `save_har` returns, then quantized HAR after
optimization and the second successful save, then HEF after its file is closed. There is no
distinct full-precision optimized stage in this recipe: it is explicitly `not_used`.
File presence alone cannot prove a completed stage. Interrupted saves remain in the attempt
for inspection but their bytes are excluded from the diagnostic ZIP.
The calibration member has a committed hash/size identity in the manifest. Before creating a ready
archive, finalization checks that identity and equality of its parsed contents with manifest calibration.
An interrupted journal update, missing member or changed/contradictory bytes causes a retention error;
raw evidence and earlier successful HARs remain locally, without a misleading ready ZIP.

After child exit, the parent alone finalizes redacted `stdout.log`, `stderr.log` and the manifest.
`compile-diagnostics.zip` is ready only after completion, ZIP validation and hashing. It contains:

- Manifest, logs, exact generated `model.alls`, generated `nms_config.json` when available.
- `calibration.json`: requested/actual counts, exact sorted selected names/order/byte hashes,
  RGB letterbox preprocessing (PIL bilinear, centered pad 114, float32 NHWC 0..255, /255 in model script).
- `native.har` and `quantized.har` only for successfully saved stages.

The ZIP excludes calibration image bytes, source ONNX/PT weights, environment/auth/command dumps
and duplicate HEF bytes. ONNX/HEF hashes and sizes link the separate artifacts.
Diagnostic hashes are plain SHA256 hex; existing registry/runtime hashes retain their `sha256:` convention.
Supplied source hashes are checked against actual bytes before SDK launch, accepting either convention.
The child rechecks the source identity before parsing.

The manifest separates requested options, successfully applied generated script and unknown SDK-internal
adjusted settings. Installed SDK/compiler version is observed in the child, never inferred from schema pins.
The SDK client's `hailo_sdk_client.__version__` and compiler's
`importlib.metadata.version("hailo_dataflow_compiler")` are queried independently and each has
its own evidence source. Neither value is copied to the other; unavailable values are null plus reason.
FIXTURE attempts have no measured installed SDK/compiler version and say so explicitly.
Graph-derived family/task and validated node names are observations. Requested parse options and
recipe-selected/supplied start/end nodes and NMS mode are recorded separately; these are not measurements
of SDK effective settings.

Missing SDK/version/calibration evidence uses null plus reason. Existing HEF runtime metadata fields remain
compatible; the diagnostic manifest is the detailed evidence of requested versus observed settings.

## Live rollout prerequisite

Publishing this code is not a Supabase deployment or proof of live SDK compatibility.
Before the next training run requests HEF compilation, the deployed artifact endpoints must accept the new `compile_diagnostics` kind and `compile-diagnostics.zip` extension.
At minimum, assess the upload-artifact and download-artifact deployments against the updated shared artifact map.
Other consumers of that map are list-deployed-models, resolve-channel and storage-usage.
Deployment and live validation require separate approval.
An older upload endpoint can reject the diagnostics archive and fail the requested compile flow even when model compilation succeeds.
Preserve the printed local attempt directory if persistence fails.

## Failure and retrieval

Optimization failure retains native HAR; compilation failure retains both HARs. Launch/import/preflight
failure retains initial identity and available logs without fabricating HAR stages. A ready ZIP for a partial
compile does not make the requested compile flow successful. Archive errors expose `RetentionError` with
the retained attempt directory, without claiming a ready ZIP. If the entire parent/process/system is killed
before finalization, an in-progress journal can survive, but archive completion is not guaranteed.

`compile_onnx_to_hef` returns `HefArtifact.diagnostics`; `CompileFailure.archive` carries partial ready diagnostics.
`compile_hef.py` prints the local path on both outcomes and does not bootstrap live storage. Existing wheel/venv
preparation behavior is unchanged. Local CLI example (requires separately authorized real SDK execution):

```sh
python scripts/compile_hef.py --onnx best.onnx --calib-dir ./calib \
  --wheel ./hailo_dataflow_compiler.whl --out-dir ./retained
```

The training run reuses `upload_artifact` for one `compile_diagnostics` kind, extension `compile-diagnostics.zip`,
content type `application/zip`. Every attempt uses the unique upload stem `<semver>-compile-<attempt_id>`;
the version's semver remains original. The **actual returned R2 key** is in
`versions.artifacts.compile_diagnostics.key` and the external `persistence.json` receipt. Models lists this
artifact and uses its existing download action. The run's local release output includes the ZIP under its
canonical `compile-diagnostics.zip` name and version metadata links local identity and actual uploaded key.
No DB migration or separate attempt-history registry is needed.

Diagnostics upload is attempted on success and partial SDK failure independently of HEF/meta uploads.
Upload failure keeps local HARs/ZIP, records persistence failure when the receipt can be written, registers
no nonexistent remote artifact and fails the requested flow. Receipt failure is surfaced even after a real
upload. The receipt writer itself redacts supplied known-secret values recursively, including nested
errors/URLs. Context stays in memory and is absent from public `ReadyArchive` metadata and persisted files.
Redaction context applies to the ready object returned by finalization in this process. Original compile
and retention/upload errors are reported together. PT/ONNX partial uploads remain.
HAR output is outside the calibration directory recreated by `build_calib_dir`.

## Colab and future SDK reload

`compile_run.ipynb` uses the same package helpers at mounted Drive `WORK/compile-attempts/<uuid>/`, outside
`/content`'s disposable storage. Invocation handles are cleared before imports or attempt creation;
SDK import preflight runs afresh after the attempt exists, captures its logs and finalizes before a failed
assertion. Failed preflight never launches compilation. Begin/import/finalize failure cannot expose an
older HEF or diagnostic handle. Downstream verification/retrieval requires this invocation's successful HEF.
`HEF_PATH`, mtime checks
and verifier all reference this exact attempt, never a sorted old `*.hef`. Download `DIAGNOSTICS.path`
even after partial failure, or open its printed attempt folder in Drive. Preserve the original source-export
commit separately from the compile commit.

`train_run.ipynb` uses the existing R2 upload flow. Its local run files are disposable until uploaded; recover
the printed local directory before deleting the runtime when R2 upload failed. The notebook's manual-dataset
QA code is unchanged by this feature.

Future authorized SDK reload can use the constructor documented by upstream
[Hailo Model Zoo `optimize(args)`](https://raw.githubusercontent.com/hailo-ai/hailo_model_zoo/master/hailo_model_zoo/main_driver.py):

```python
from hailo_sdk_client import ClientRunner
runner = ClientRunner(hw_arch="hailo8l", har=har_path)
```

This path was documented, not executed in this feature pass. **Real SDK reload, Colab Drive durability,
live R2 persistence and native Deno/live Supabase remain UNVERIFIED.** No model quality or historical reconstruction is claimed.

## Offline sample

```sh
.venv/bin/python scripts/generate_compile_diagnostics_fixture.py \
  --out .scratch/har-retention/fixture-sample
.venv/bin/python -m pytest tests/test_compile_diagnostics.py -q
```

The generator produces valid fixture calibration images, measured hashes and new exclusive attempts on each
invocation. `latest-fixture.json` identifies the manifest, ZIP and selected image directory. Everything is
prominently **FIXTURE ONLY**: HAR/HEF/ONNX placeholder bytes are not valid SDK-loadable models.
