"""ONNX export wrapper for a trained YOLO model.

Calls ``model.export(format='onnx', ...)`` and returns the path to the
exported file.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any


def export_onnx(
    model: Any,
    out_dir: str | Path,
    imgsz: int = 640,
    opset: int = 17,
    simplify: bool = True,
    dynamic: bool = False,
) -> Path:
    """Export ``model`` to ONNX. Returns the exported file path."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    onnx_path = model.export(
        format="onnx",
        imgsz=imgsz,
        opset=opset,
        simplify=simplify,
        dynamic=dynamic,
    )
    return Path(onnx_path)
