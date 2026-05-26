# Roadmap

## Phase 0 — Scaffold ✅

- repo skeleton
- docs + contracts placeholders
- placeholder web UI

## Phase 1 — BSCP Training Pipeline ✅ (foundation complete)

- ✅ Supabase schema (7 migrations applied)
- ✅ 10 edge functions deployed (R2 + HMAC callback)
- ✅ Python tool library (contracts, RegistryClient, dataset, training, eval, hailo, release)
- ✅ `scripts/train_for_run.py` orchestrator
- ✅ Colab notebook
- ✅ Web dashboard (auth + runs list + new run + live metrics)
- ⏸️ First end-to-end run on a real dataset (next: upload first dataset + smoke run)
- ⏸️ Hailo HEF compile validated on Colab GPU runtime

## Phase 2 — Common Training Pipeline (future, post-second-project)

Trigger: second iPassion model line needs the same infra.

- Extract generic `train-ml-core` Python package
- Multi-tenant schema (`projects` table above `model_lines`)
- Per-project Colab notebook templates
- Tool flow registry (swap HEF compile for TensorRT / TFLite / CoreML)
- Web UI: channel promotion, artifact downloads, run comparison
- Registry abstraction (file/db swap)

## Phase 3 — Operations / Scale (post Phase 2)

- Cloudflare R2 → S3 migration option
- CI-triggered training (no Colab) via `start-training` to external provider
- Per-org RBAC
- Model A/B testing via `channel_deployments.is_default` flip
- Deployment compatibility metadata for multiple edge SoCs
