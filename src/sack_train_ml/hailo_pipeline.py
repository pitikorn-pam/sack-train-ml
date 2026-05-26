"""Hailo HEF compile pipeline.

Orchestrates ONNX → HEF compilation via the ``hailomz`` CLI (vendor SDK).
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .contracts import sha256_file


@dataclass
class HefArtifact:
    hef_path: Path
    hef_meta_path: Path
    quantization: dict[str, Any] = field(default_factory=dict)


def compile_hef(
    onnx_path: str | Path,
    calibration_manifest: str | Path,
    out_dir: str | Path,
    model_name: str,
    target: str = "hailo8l",
    input_shape: tuple[int, int, int] = (640, 640, 3),
    hailomz_bin: str = "hailomz",
) -> HefArtifact:
    onnx_path = Path(onnx_path)
    calib = Path(calibration_manifest)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    hef_path = out / f"{model_name}.hef"

    cmd = [
        hailomz_bin, "compile",
        "--ckpt", str(onnx_path),
        "--calib-set", str(calib),
        "--hw-arch", target,
        "--output-path", str(hef_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"hailomz compile failed (exit {result.returncode}):\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )
    if not hef_path.exists():
        raise FileNotFoundError(f"hailomz finished but {hef_path} not present")

    sha, size = sha256_file(hef_path)
    meta = {
        "model_name": model_name,
        "target": target,
        "input_shape": list(input_shape),
        "source_onnx": onnx_path.name,
        "hef_size_bytes": size,
        "hef_sha256": sha,
        "compiler": "hailomz",
    }
    meta_path = out / f"{model_name}.hef.meta.yaml"
    meta_path.write_text(_dump_simple_yaml(meta))

    return HefArtifact(
        hef_path=hef_path,
        hef_meta_path=meta_path,
        quantization={
            "precision": "int8",
            "method": "hailo_compile",
            "calibration_manifest": str(calib),
            "target": target,
        },
    )


def _dump_simple_yaml(d: dict[str, Any]) -> str:
    lines = []
    for k, v in d.items():
        if isinstance(v, list):
            lines.append(f"{k}: " + json.dumps(v))
        else:
            lines.append(f"{k}: {v}")
    return "\n".join(lines) + "\n"
