.PHONY: help web-dev train export compile meta release

help:
	@echo "Scaffold only. No real implementation yet."
	@echo "Targets reserved: web-dev train export compile meta release"

web-dev:
	@echo "TODO: run apps/web dev server"

train:
	@echo "TODO: run scripts/train_yolo.py"

export:
	@echo "TODO: run scripts/export_onnx.py"

compile:
	@echo "TODO: run scripts/compile_hef.py"

meta:
	@echo "TODO: run scripts/build_hef_meta.py"

release:
	@echo "TODO: run scripts/release_bundle.py"
