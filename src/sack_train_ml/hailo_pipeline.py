"""Hailo compile pipeline scaffold.

Planned stages:
- ONNX export handoff
- parse
- optimize with calibration set
- compile HEF
- evaluate INT8 quality
"""

from __future__ import annotations


def compile_hef(config: dict) -> dict:
    raise NotImplementedError("HEF compilation pipeline not implemented yet")
