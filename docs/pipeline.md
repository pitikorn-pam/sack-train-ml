# Pipeline

## Target flow

```text
dataset validate
  -> train pt
  -> eval fp32
  -> export onnx
  -> hailo parse/optimize/compile
  -> eval int8
  -> build hef meta
  -> assemble release bundle
```

## Release bundle target

Minimum downloadable outputs:
- `best.pt`
- `model.hef`
- `model.hef.meta.yaml`
- `release-manifest.json`
