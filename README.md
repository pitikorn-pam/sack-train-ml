# sack-train-ml

BSCP sack detector training pipeline — YOLO 11s → ONNX → Hailo HEF, orchestrated through Supabase + Cloudflare R2 + Google Colab.

## Status — Phase 1 (foundation complete, awaiting first real run)

| Layer | Status |
|-------|--------|
| Supabase schema | 11 migrations in the repo; 01–09 applied to cloud, 10 (evaluations + clips) and 11 (experiments) written and not yet applied |
| Edge functions  | 13 in the repo; the two evaluation-queue functions are new and not yet deployed |
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
supabase functions deploy --use-api
#
# NOT --no-verify-jwt. That flag turns off the gateway's signature check, and the
# functions' own auth helpers decode a JWT payload WITHOUT verifying it — they read
# claims from a token the gateway is supposed to have already authenticated. With the
# flag on, a hand-made `header.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.x` passes every check.
#
# Audited against the live project 2026-09-07: six deployed functions still carry
# verify_jwt=false — download-artifact, download-dataset, start-training,
# training-callback, upload-artifact, upload-dataset. See docs/security.md.

# 4. Run the web dashboard
cd apps/web
cp .env.example .env.local && $EDITOR .env.local  # VITE_SUPABASE_*
npm install && npm run dev   # → http://localhost:5173
```

Inside the dashboard:
1. Sign in with a username and password (a bare username is suffixed `@ipassion.co.th`).
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
│   ├── hailo_pipeline.py      compile_hef via the DFC ClientRunner in a subprocess venv
│   └── release.py             bundle assembly + manifest
│
├── scripts/
│   ├── train_for_run.py       main entrypoint (Colab calls this)
│   ├── compile_clientrunner.py  the real DFC compile recipe
│   └── probe_cls_activation.py  answers "does DFC insert the cls sigmoid"

├── contracts/
│   ├── param-schema.json      ONE schema: read by the web form, the edge function
│   │                          and the Python pipeline. Not copied — imported.
│   └── verify-contract.mjs    the server-side validator's own test
│
├── supabase/
│   ├── config.toml            project_id = "bscp-model-registry"
│   ├── migrations/            11 SQL files (model_lines through experiments)
│   └── functions/             13 edge functions + _shared/ (8 helpers)
│
├── notebooks/
│   └── train_run.ipynb        Colab orchestrator
│
├── apps/web/                  Vite + React 19 dashboard
│   └── src/
│       ├── lib/               supabase, schema, labApi, prefill, writes, profiles
│       ├── components/        Auth, RunsList, RunDetail, NewRunV3, ColabSteps
│       ├── sections/          Overview, Train, Models, Storage, Lab
│       └── App.tsx
│
├── apps/api/lab_server.py     the Lab's FastAPI backend (127.0.0.1:8077)
├── webui/                     lab_core.py + lab_path.py — the Lab's counting engine
│                              NOTE: a greedy centroid tracker, NOT the device's
│                              ByteTrack. The two count differently; see
│                              .scratch/experiment-lab/.
│
├── configs/                   *.example.yaml (dataset, train, hailo, release)
├── docs/                      architecture.md, pipeline.md, roadmap.md, testing.md
├── DESIGN.md                  the design system every screen follows
├── tests/                     pytest — 88 passing
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
