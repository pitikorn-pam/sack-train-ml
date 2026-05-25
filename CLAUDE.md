# CLAUDE.md

This file provides repo-specific guidance for working in `sack-train-ml`.

## What this repo is

A future training and release pipeline for BSCP sack detector models.

The design intentionally follows the useful parts of `advance-seeds-field-inspector-ml`, but targets:
- YOLO training artifacts (`.pt`)
- ONNX export
- Hailo compile flow
- HEF release bundles

Not mobile exports.
Not edge runtime code.

## Immediate goal

Short-term output should make it possible to produce and download:
- `best.pt`
- `model.hef`
- `model.hef.meta.yaml`
- `release-manifest.json`

## Future goal

Add a model registry and web flows for:
- browse runs
- compare metrics
- inspect release bundles
- promote artifacts to channels

## Recommended repo shape

```text
src/sack_train_ml/
  contracts.py         artifact / release / metric schemas
  training.py          config parsing and training orchestration
  evaluation.py        metric normalization and gates
  hailo_pipeline.py    onnx -> hef pipeline orchestration
  registry.py          future file/db-backed registry layer
scripts/
  train_yolo.py
  export_onnx.py
  compile_hef.py
  build_hef_meta.py
  release_bundle.py
apps/web/
  src/
    pages/
    components/
    lib/
docs/
  architecture.md
  pipeline.md
  roadmap.md
```

## Design rules

1. Keep training-side concerns here.
2. Keep edge runtime deployment concerns out.
3. Prefer generated metadata over handwritten metadata.
4. Every release artifact should be traceable to config + dataset + code revision.
5. Do not add registry complexity before the local artifact pipeline is sound.

## Planned artifact contract

A future HEF release bundle should contain:
- `best.pt`
- `model.onnx`
- `model.hef`
- `model.hef.meta.yaml`
- `eval-fp32.json`
- `eval-int8.json`
- `release-manifest.json`

## Planned web UI

The web app should eventually support:
- training run list
- run detail page
- pipeline stage timeline
- artifact downloads
- release bundle inspection
- registry-ready data model

For now, only scaffold placeholder pages/components.

## OpenSpec

This repo should follow the same spec-driven workflow pattern as other BSCP repos.
The `openspec/` directory is scaffolded but not populated with active changes yet.
