# Pipeline

## Target flow

```
dataset validate
  → train pt
  → eval fp32
  → export onnx
  → hailo parse/optimize/compile
  → eval int8                    (best-effort in Phase 1)
  → build hef meta
  → gate check (FP32 vs INT8)
  → upload artifacts to R2
  → create versions row
  → finalize run
```

## Stage-by-stage (Phase 1)

| # | Stage | Implementation | Streamed metric / log |
|---|-------|----------------|----------------------|
| 1 | Init | `train_for_run.py` boots, marks `runs.status = 'running'` | `log_step(1, "init", "info", ...)` |
| 2 | Dataset materialize | Files: `download-dataset` (if R2 key) or local override. Roboflow: checked directory prepared by the Colab notebook | `log_step(2, "dataset", "info", ...)` |
| 3 | Dataset validate | `dataset.validate_dataset()` — count images/labels, class match | `log_step(2, "dataset", "ok", "...")` |
| 4 | Train | `training.train_yolo()` with `on_fit_epoch_end` callback | per-epoch `log_metric` for every YOLO metric + synthetic `progress` |
| 5 | Eval FP32 | `model.val()` | `log_step(4, "eval-fp32", "ok", "...")` |
| 6 | Export ONNX | `export_onnx.export_onnx()` | `log_step(5, "export", "ok", "...")` |
| 7 | Compile HEF | `hailo_pipeline.compile_hef()` via `hailomz` CLI | `log_step(6, "hef-compile", "ok"\|"warning", ...)` |
| 8 | Eval INT8 | best-effort hook (Phase 2 wires real HEF inference) | `log_step(7, "eval-int8", ...)` |
| 9 | Gate | `evaluation.gate_check()` — FP32 vs INT8 mAP50 delta | `log_step(8, "gate", "ok"\|"warning", ...)` |
| 10 | Upload | `client.upload_artifact()` × 4 kinds → R2 PUT | `log_step(9, "upload", "ok", "Uploaded N artifacts")` |
| 11 | Version row | `client.create_version()` — Postgres trigger fills `compat_signature` | `log_step(10, "version", "ok", "Version v1.0.0-... created")` |
| 12 | Finalize | `client.finalize_run("succeeded")` via HMAC callback | finishes |

## Dataset source contract

Files requests retain `dataset` (string), optional `dataset_bundle`, and ordered
`classes`. Roboflow creation requests contain only `dataset_source` with `kind:
roboflow`, `workspace`, `project`, positive integer `version`, and `format: yolov8`
or `yolov11`; they omit `dataset`, `dataset_bundle`, and `classes`.

The web form parses the standard Python snippet locally as data and discards its
API key and raw text. It does not call the Lab API or upload Roboflow datasets to
R2. Manual YAML/ZIP uploads and saved datasets retain their R2 flow.

`notebooks/train_run.ipynb` alone calls `sack_train_ml.roboflow.prepare_dataset`.
It obtains `ROBOFLOW_API_KEY` from Colab Secrets with a hidden `getpass` fallback,
keeps the key out of environment variables and subprocess arguments, and downloads
under `/content/datasets/<run-id>/<attempt-id>/roboflow`. The adapter validates HTTPS
hosts, redirects, archive sizes/paths, YAML hooks, and credentials before extraction.
Errors suppress upstream HTTP details and chained exceptions.

`RegistryClient.load_run_config(..., dataset_dir=...)` checks the non-secret source
marker and YAML, resolves contiguous numeric class IDs (or list order), and checks
`nc`. It persists only the resolved classes into the existing config with an
optimistic, checked update that preserves other fields before training starts.
Without the prepared matching directory, Roboflow execution fails; a manual
override cannot silently replace it. `RunConfig` remains training-ready.

The source and resolved classes appear in existing effective-config, release
manifest, and version metadata. Model artifact publishing remains on R2.
Local mocked tests do not deploy the cloud validator or publish the hosted notebook.

## Release bundle (on-disk + R2)

Locally written to `runs/{run_id}/release/`:

- `best.pt`
- `model.onnx`
- `model.hef`
- `model.hef.meta.yaml`
- `eval-fp32.json`
- `eval-int8.json` (if INT8 eval ran)
- `release-manifest.json`

Same artifacts uploaded to R2 under `runs/{run_id}/{semver}.{ext}` and registered in `versions.artifacts` JSONB.

## Failure paths

| Failure | Behavior |
|---------|----------|
| Dataset validation fails | `log_step("dataset", "error")` → `finalize_run("failed", error)` → notebook exits 1 |
| YOLO train raises | `log_step("training", "error")` → `finalize_run("failed", error)` |
| HEF compile fails | `log_step("hef-compile", "warning")` — rest of pipeline continues (artifact set will not include `hef`) |
| Upload fails | full failure path |
| Callback HTTP 5xx | one auto-retry, then raise |

Idempotency: `run_metrics` PK = `(run_id, step, name)` — re-running the same step overwrites (upsert).
