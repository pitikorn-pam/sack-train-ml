# Architecture (Phase 1)

## Intent

`sack-train-ml` is the **training-side companion** to `sack-detector-edge`. It owns artifact production — not runtime inference.

Phase 1 deliverable: a working pipeline that takes a labeled dataset and produces a Hailo HEF release bundle, with full metric streaming + artifact registry in Supabase. BSCP is the first model line; the schema and tooling are designed to host more lines later (Phase 2).

## Boundaries

| In scope | Out of scope |
|----------|--------------|
| Dataset configs, train configs, calibration manifests | Edge runtime deployment |
| YOLO `.pt` training + FP32 eval                       | MQTT contracts |
| ONNX export                                           | Node-RED flows |
| Hailo parse / optimize / compile / INT8 eval          | Container control / orchestration |
| Release bundle assembly + manifest                    | bscp-service business logic |
| Model registry + run history                          | Live device communication |

## Layered architecture

```
┌────────────────────────────────────────────────────┐
│  apps/web         React 19 + Vite + Supabase JS    │   ← Operator UI
│  Auth · Runs list (Realtime) · New run · Detail    │
└────────────────────────┬───────────────────────────┘
                         │ Supabase JS client (RLS-gated)
                         ▼
┌────────────────────────────────────────────────────┐
│  supabase/functions    Deno edge functions         │   ← API + R2 broker
│  start-training · upload/download-artifact ·       │
│  training-callback (HMAC) · upload/download/       │
│  delete-dataset · resolve-channel ·                │
│  list-deployed-models · storage-usage              │
└──────────┬────────────────────────────┬────────────┘
           │ Postgres                   │ S3 API
           ▼                            ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│ Supabase Postgres       │  │ Cloudflare R2           │
│ model_lines / runs /    │  │ runs/{id}/{semver}.*    │
│ run_metrics / versions /│  │ datasets/{slug}/...     │
│ channels / deployments  │  │                         │
└─────────────────────────┘  └─────────────────────────┘
           ▲                            ▲
           │ REST (service-role JWT)    │ Presigned URLs (15-min)
           │                            │
┌──────────┴────────────────────────────┴────────────┐
│  Colab notebook → scripts/train_for_run.py         │   ← Execution
│  RegistryClient ← src/sack_train_ml/*              │
└────────────────────────────────────────────────────┘
                         │
                         │ release bundle
                         ▼
                 sack-detector-edge
                 (loads .hef on Hailo-8L)
```

## Module map

| Module | Role |
|--------|------|
| `src/sack_train_ml/contracts.py` | Dataclasses: RunConfig, ArtifactRecord, ReleaseManifest |
| `src/sack_train_ml/supabase_client.py` | RegistryClient — REST + edge fn + HMAC callback |
| `src/sack_train_ml/dataset.py` | YOLO dataset YAML loader + validation |
| `src/sack_train_ml/training.py` | YOLO orchestration + per-epoch metric callback |
| `src/sack_train_ml/evaluation.py` | Metric normalization + FP32-vs-INT8 gate |
| `src/sack_train_ml/export_onnx.py` | ONNX export wrapper |
| `src/sack_train_ml/hailo_pipeline.py` | ONNX → HEF via hailomz + meta YAML |
| `src/sack_train_ml/release.py` | Bundle assembly + manifest serialization |
| `scripts/train_for_run.py` | Main entrypoint called by the notebook |

## Storage layout (R2)

```
{R2_BUCKET}/
├── runs/{run_id}/
│   ├── {semver}.pt           ← best PyTorch checkpoint
│   ├── {semver}.onnx         ← exported ONNX
│   ├── {semver}.hef          ← Hailo binary
│   └── {semver}.hef.meta.yaml
└── datasets/{model_line_slug}/{ISO-stamp}/
    ├── dataset.yaml
    └── dataset.zip           ← optional bundled images+labels
```

## Auth model

| Caller | Mechanism |
|--------|-----------|
| Web dashboard | Supabase Auth (magic link) → JWT with `authenticated` role |
| Admin operations | Same JWT + `app_metadata.role = 'admin'` (RLS gate) |
| Colab notebook | Service-role JWT (pasted into prompt) — bypasses RLS |
| training-callback | HMAC-SHA256 over body, secret = `TRAINING_CALLBACK_SECRET` |
| Edge runtime (future) | Public `resolve-channel` + `list-deployed-models` GET endpoints |

## Compat signature

Every `versions` row carries `compat_signature` = SHA-256 of canonical-JSON of `(class_names, input_size, output_kind, task)`. The runtime compares its current signature to the channel's version — mismatch triggers `rebuild_required` rather than silent acceptance.

## Phase 1 → Phase 2 evolution

Phase 1 lives in this repo with BSCP-specific defaults (yolo11s.pt, hailo8l, "sack" class).

Phase 2 will extract:
- Generic `train-ml-core` Python package
- Tool flow framework (RunConfig → tool chain), not BSCP-bound
- Multi-tenant Supabase schema (`projects` table above `model_lines`)
- Per-project Colab notebook templates

Trigger: when project #2 needs it. Not before — premature abstraction is the failure mode to avoid.
