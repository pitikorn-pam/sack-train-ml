# sack-train-ml

BSCP sack detector training pipeline — YOLO 11s → ONNX → Hailo HEF, orchestrated through Supabase + Cloudflare R2 + Google Colab.

## Status — Phase 1 (foundation complete, awaiting first real run)

| Layer | Status |
|-------|--------|
| Supabase schema | ✅ 7 migrations applied to cloud |
| Edge functions  | ✅ 10 functions deployed |
| Python pipeline | ✅ `src/sack_train_ml/` + `scripts/train_for_run.py` |
| Colab notebook  | ✅ `notebooks/train_run.ipynb` |
| Web dashboard   | ✅ minimal (auth + runs list + new-run form + realtime metrics) |
| **First end-to-end run** | ⏸️ pending real dataset upload |

## Architecture (Phase 1)

```
                  Web dashboard
                  (Vite + React 19 + Supabase JS)
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │  Supabase Postgres (model registry)  │
        │  model_lines / runs / run_metrics    │
        │  versions / channels / deployments   │
        └────────────────┬─────────────────────┘
                         │
                         │ edge functions (Deno)
                         │ start-training, upload-artifact,
                         │ training-callback (HMAC), …
                         │
                         ▼
        ┌──────────────────────────────────────┐
        │  Cloudflare R2 (artifact + dataset)  │
        │  runs/{id}/{semver}.{pt|onnx|hef}    │
        │  datasets/{slug}/{stamp}/{file}      │
        └──────────────────────────────────────┘
                         ▲
                         │
        Colab notebook ──┘
        (reads ?run_id=, prompts service-role key,
         runs scripts/train_for_run.py)
                         │
                         ▼
                 Hailo HEF released
                 → consumed by sack-detector-edge
```

## North Star

A **central training pipeline** that is generic enough to host any iPassion model line (not just BSCP). BSCP is Phase 1's first concrete instance. Phase 2 extracts the common framework once a second project arrives.

## Quickstart (operator)

```bash
# 1. Fill .env (copy from .env.example) — Supabase + R2 + callback secret
cp .env.example .env
$EDITOR .env

# 2. Push migrations to Supabase (one-time)
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push

# 3. Deploy edge functions (one-time, redeploy on change)
supabase secrets set --env-file .env  # or list explicit vars
supabase functions deploy --use-api --no-verify-jwt

# 4. Run the web dashboard
cd apps/web
cp .env.example .env.local && $EDITOR .env.local  # VITE_SUPABASE_*
npm install && npm run dev   # → http://localhost:5173
```

Inside the dashboard:
1. Sign in with magic link.
2. **New run** → fill config JSON (dataset R2 key + classes + hyperparams) → submit.
3. Browser opens Colab with `?run_id=<uuid>` appended.
4. In Colab: Runtime → Run all. Paste service-role + callback secret when prompted.
5. Watch live metrics on the dashboard run detail page.
6. On success, artifacts (`pytorch`, `onnx`, `hef`, `hef_meta`) are in R2 + a `versions` row exists.

## Repo Layout

```text
sack-train-ml/
├── src/sack_train_ml/        Python tool library
│   ├── contracts.py           dataclasses (RunConfig, ArtifactRecord, ReleaseManifest)
│   ├── supabase_client.py     RegistryClient — REST + edge fn + HMAC callback
│   ├── dataset.py             YOLO dataset validation
│   ├── training.py            YOLO orchestration + metric callback
│   ├── evaluation.py          metric normalize + gate verdict
│   ├── export_onnx.py         model.export(format="onnx") wrapper
│   ├── hailo_pipeline.py      compile_hef via hailomz CLI
│   └── release.py             bundle assembly + manifest
│
├── scripts/
│   └── train_for_run.py       main entrypoint (Colab calls this)
│
├── supabase/
│   ├── config.toml            project_id = "bscp-model-registry"
│   ├── migrations/            7 SQL files (model_lines through realtime)
│   └── functions/             10 edge functions + _shared/ (6 helpers)
│
├── notebooks/
│   └── train_run.ipynb        Colab orchestrator
│
├── apps/web/                  Vite + React 19 dashboard
│   └── src/
│       ├── lib/supabase.ts
│       ├── components/        Auth, RunsList, RunDetail, NewRun
│       └── App.tsx
│
├── configs/                   *.example.yaml (dataset, train, hailo, release)
├── docs/                      architecture.md, pipeline.md, roadmap.md
├── tests/                     pytest skeleton
└── openspec/                  spec-driven dev scaffold (Phase 2)
```

## Cross-Repo Contract — sack-detector-edge

The deliverable to `sack-detector-edge` is a **release bundle** materialized in R2:

```
runs/{run_id}/{semver}.pt        ← QA / rollback
runs/{run_id}/{semver}.onnx      ← intermediate
runs/{run_id}/{semver}.hef       ← Hailo runtime binary
runs/{run_id}/{semver}.hef.meta.yaml  ← input shape / target / class names
```

Plus a `versions` row in Supabase that the edge device polls via `resolve-channel`.

## Phase 2 (future)

- Extract `sack_train_ml.*` modules into a generic `train-ml-core` package
- Add second model line (proves the abstraction)
- Web dashboard: artifact downloads, channel promotion UI
- Registry abstraction (file/db backend swap)
- See `docs/roadmap.md`

## License

Internal — iPassion Co., Ltd.
