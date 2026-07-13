#!/usr/bin/env python3
"""build_hef_meta.py — (re)generate the ``*.hef.meta.yaml`` sidecar for a HEF.

The meta sidecar is normally written by ``hailo_pipeline.compile_onnx_to_hef``
during compile. Use this to regenerate it for an existing .hef (e.g. one built
before the meta writer existed, or hand-copied off a device).

Example:
    python scripts/build_hef_meta.py --hef yolov11s_sack.hef \
        --source-onnx best.onnx --opt-level 0 --classes 2
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
from sack_train_ml.hailo_pipeline import _dump_simple_yaml


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--hef", required=True)
    p.add_argument("--source-onnx", default=None)
    p.add_argument("--target", default="hailo8l")
    p.add_argument("--size", type=int, default=640)
    p.add_argument("--classes", type=int, default=2)
    p.add_argument("--opt-level", type=int, default=0)
    p.add_argument("--calib-n", type=int, default=None)
    p.add_argument("--git-sha", default=None)
    a = p.parse_args(argv)

    hef = Path(a.hef)
    if not hef.exists():
        p.error(f"hef not found: {hef}")

    sha, size = sha256_file(hef)
    onnx_sha = None
    if a.source_onnx and Path(a.source_onnx).exists():
        onnx_sha, _ = sha256_file(a.source_onnx)

    # Auto-detect head family + NMS mode when the source ONNX is available, so a
    # regenerated meta matches what compile_onnx_to_hef writes. Absent otherwise.
    family = nms_mode = None
    if a.source_onnx and Path(a.source_onnx).exists():
        try:
            sys.path.insert(0, str(Path(__file__).resolve().parent))
            from compile_clientrunner import detect_head

            family, _task, nms_mode, _end = detect_head(a.source_onnx)
        except Exception as e:  # onnx missing or unrecognized graph — leave absent
            print(f"[meta] head auto-detect skipped: {e}")

    meta = {
        "model_name": hef.stem,
        "target": a.target,
        "input_shape": [a.size, a.size, 3],
        "classes": a.classes,
        "source_onnx": Path(a.source_onnx).name if a.source_onnx else None,
        "source_onnx_sha256": onnx_sha,
        "git_sha": a.git_sha,
        "hef_size_bytes": size,
        "hef_sha256": sha,
        "compiler": "dfc_clientrunner",
        "model_family": family,
        "optimization_level": a.opt_level,
        "calib_images": a.calib_n,
        "nms": {"mode": nms_mode},
    }
    meta_path = hef.with_suffix(hef.suffix + ".meta.yaml")
    meta_path.write_text(_dump_simple_yaml(meta))
    print(f"META -> {meta_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
