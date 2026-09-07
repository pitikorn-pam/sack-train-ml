# scripts/

Reserved CLI entrypoints:

- `train_yolo.py`        train `.pt`
- `export_onnx.py`       export `.onnx`
- `compile_hef.py`       compile `.hef`
- `build_hef_meta.py`    generate `.hef.meta.yaml`
- `release_bundle.py`    assemble downloadable bundle

Current state: `train_for_run.py`, `compile_clientrunner.py`, `compile_hef.py`, `build_hef_meta.py`, `test_inference.py` and `probe_cls_activation.py` are real. The three `*_stub` entrypoints below still echo TODO.
