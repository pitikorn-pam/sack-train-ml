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
| 2 | Dataset materialize | `download-dataset` edge fn (if R2 key) → local path | `log_step(2, "dataset", "info", ...)` |
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
