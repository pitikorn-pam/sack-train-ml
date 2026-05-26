"""Evaluation — normalize metrics + apply gate verdict.

Phase 1: gate compares the FP32 PyTorch model's val mAP against the HEF INT8
model's val mAP. If the delta is within ``max_map_drop`` the gate passes.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class GateVerdict:
    passed: bool
    fp32_map: float | None
    int8_map: float | None
    delta: float | None
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "passed": self.passed,
            "fp32_map": self.fp32_map,
            "int8_map": self.int8_map,
            "delta": self.delta,
            "reason": self.reason,
        }


def normalize_metrics(raw: dict[str, Any]) -> dict[str, float]:
    aliases = {
        "metrics/mAP50(B)": "map50",
        "metrics/mAP50-95(B)": "map50_95",
        "metrics/precision(B)": "precision",
        "metrics/recall(B)": "recall",
    }
    out: dict[str, float] = {}
    for k, v in raw.items():
        canonical = aliases.get(k, k)
        try:
            out[canonical] = float(v)
        except (TypeError, ValueError):
            continue
    return out


def gate_check(
    fp32_eval: dict[str, Any] | str | Path,
    int8_eval: dict[str, Any] | str | Path,
    max_map_drop: float = 0.03,
) -> GateVerdict:
    fp = _load(fp32_eval)
    iq = _load(int8_eval)
    fp_norm = normalize_metrics(fp)
    iq_norm = normalize_metrics(iq)
    fp_map = fp_norm.get("map50")
    iq_map = iq_norm.get("map50")
    if fp_map is None or iq_map is None:
        return GateVerdict(
            passed=False, fp32_map=fp_map, int8_map=iq_map, delta=None,
            reason="missing map50 in one of the eval files",
        )
    delta = fp_map - iq_map
    passed = delta <= max_map_drop
    return GateVerdict(
        passed=passed, fp32_map=fp_map, int8_map=iq_map, delta=delta,
        reason=(
            f"OK (delta {delta:.4f} <= {max_map_drop})"
            if passed
            else f"FAIL (delta {delta:.4f} > {max_map_drop})"
        ),
    )


def _load(src: dict[str, Any] | str | Path) -> dict[str, Any]:
    if isinstance(src, (str, Path)):
        return json.loads(Path(src).read_text())
    return dict(src)
