#!/usr/bin/env python3
"""compile_hef.py — standalone CLI to compile a local ONNX into a Hailo HEF.

This is the offline / manual entrypoint. The training pipeline compiles HEF
in-flow via ``train_for_run.py`` (step 6b) — use this when you have a .onnx on
disk and want to (re)compile without a full training run.

It wraps ``sack_train_ml.hailo_pipeline``: bootstrap the DFC venv from a local
wheel, sample a calib dir (from a dataset data.yaml or use an existing dir),
then compile via the ClientRunner recipe.

Example:
    python scripts/compile_hef.py \
        --onnx best.onnx --calib-dir ./calib --wheel hailo_dataflow_compiler-*.whl \
        --out-dir ./hef --opt-level 0
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from sack_train_ml.contracts import sha256_file
from sack_train_ml.hailo_pipeline import (
    build_calib_dir,
    compile_onnx_to_hef,
    ensure_dfc_venv,
)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--onnx", required=True)
    p.add_argument("--wheel", required=True, help="local path to hailo_dataflow_compiler*.whl")
    p.add_argument("--out-dir", default="./hef")
    p.add_argument("--venv-dir", default="/content/hailo_venv")
    p.add_argument("--net", default="yolov11s_sack")
    # calib: either an existing flat dir of images, or sample from a data.yaml
    p.add_argument("--calib-dir", help="existing flat dir of calib images")
    p.add_argument("--dataset-yaml", help="sample calib images from this data.yaml")
    p.add_argument("--calib-n", type=int, default=512)
    p.add_argument("--target", default="hailo8l")
    p.add_argument("--size", type=int, default=640)
    p.add_argument("--classes", type=int, default=2)
    p.add_argument("--opt-level", type=int, default=0)
    p.add_argument("--scores-th", type=float, default=0.20)
    p.add_argument("--iou-th", type=float, default=0.70)
    p.add_argument("--max-per-class", type=int, default=50)
    p.add_argument("--reg-len", type=int, default=16)
    a = p.parse_args(argv)

    if not a.calib_dir and not a.dataset_yaml:
        p.error("one of --calib-dir or --dataset-yaml is required")

    venv_py = ensure_dfc_venv(a.wheel, a.venv_dir)

    if a.calib_dir:
        calib_dir = Path(a.calib_dir)
    else:
        calib_dir = build_calib_dir(a.dataset_yaml, Path(a.out_dir) / "calib", n=a.calib_n)

    onnx_sha, _ = sha256_file(a.onnx)
    art = compile_onnx_to_hef(
        onnx_path=a.onnx,
        calib_dir=calib_dir,
        out_dir=a.out_dir,
        model_name=a.net,
        venv_python=venv_py,
        target=a.target,
        input_size=a.size,
        classes=a.classes,
        calib_n=a.calib_n,
        opt_level=a.opt_level,
        scores_th=a.scores_th,
        iou_th=a.iou_th,
        max_per_class=a.max_per_class,
        reg_len=a.reg_len,
        source_onnx_sha=onnx_sha,
    )
    print(f"\nHEF:  {art.hef_path}")
    print(f"META: {art.hef_meta_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
