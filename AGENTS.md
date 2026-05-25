# sack-train-ml Instructions

This guide applies to `/Users/pitikorn/Work/BSCP/sack-train-ml`.

## Role

`sack-train-ml` owns the **training-side model pipeline** for BSCP sack detection.

It is responsible for:
- dataset validation and preparation
- training YOLO `.pt` models
- exporting ONNX
- compiling Hailo `.hef`
- comparing FP32 vs INT8 accuracy gates
- generating release metadata and bundle manifests
- exposing training/release state in a future web UI

It does **not** own:
- edge runtime inference code
- MQTT contracts
- live RPi deployment logic
- business workflow logic from `bscp-service`

## Current state

This repository is scaffold-only.
Files may define contracts, architecture, and placeholder entrypoints, but not production training logic yet.

## Scope guard

- Only edit files inside `sack-train-ml/` unless the user explicitly broadens scope.
- Do not modify sibling BSCP repos from here.
- Do not couple this repo directly to runtime paths inside `sack-detector-edge`.
- Prefer producing portable artifacts and manifests over hardcoded copy steps.

## Architectural direction

Seed-ML patterns to reuse:
- config-driven training
- run-scoped artifact folders
- generated metadata
- normalized metric summaries
- future web + registry readiness

BSCP-specific differences:
- output target is `.hef`, not TFLite/Core ML
- evaluation must compare FP32 vs Hailo INT8 quality
- release bundle must include `.pt`, `.hef`, `.hef.meta.yaml`, and manifest JSON

## Planned pipeline

```text
dataset yaml
  -> train config
  -> fp32 training
  -> fp32 eval
  -> onnx export
  -> hailo parse/optimize/compile
  -> int8 eval
  -> gate check
  -> release bundle
```

## Validation expectations

Once implementation starts, prefer narrow checks first:
- config schema validation
- unit tests for contract builders
- artifact manifest generation tests
- focused script smoke tests

## Future registry boundary

Registry should be built **after** artifact and gating flow is stable.
For now, treat release manifests on disk as the source of truth.
