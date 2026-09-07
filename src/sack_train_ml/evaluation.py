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


# Metrics are reported to four decimals at most; a tolerance well below that cannot
# admit a genuine regression and cannot reject a genuine pass.
_FLOAT_TOLERANCE = 1e-9


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
    # A model exactly at the threshold must pass it. Without the tolerance it does not:
    # 0.90 - 0.87 is 0.030000000000000027 in binary floating point, so a drop of exactly
    # 0.03 fails a gate whose limit is 0.03. This repo has a recorded lesson about
    # thresholds the measurement cannot reach reading as a failed result; this was one.
    passed = delta <= max_map_drop + _FLOAT_TOLERANCE
    return GateVerdict(
        passed=passed, fp32_map=fp_map, int8_map=iq_map, delta=delta,
        reason=(
            f"OK (delta {delta:.4f} <= {max_map_drop})"
            if passed
            else f"FAIL (delta {delta:.4f} > {max_map_drop})"
        ),
    )


def gate_verdict_for_run(
    fp32_eval: dict[str, Any] | None,
    int8_eval: dict[str, Any] | None,
    max_map_drop: float = 0.03,
) -> dict[str, Any]:
    """The verdict a run records, including when there is nothing to compare.

    `metrics_summary.gate` used to be absent whenever an INT8 evaluation did not exist,
    which is every run: the compile quantizes but nothing measures the quantized model.
    An absent field reads as "not applicable"; a present one that says why reads as what
    it is. The difference matters because a version that was never gated must not look
    like one that passed, and this repo has already spent days on a HEF that reported
    success and counted nothing.
    """
    # `state` is three-valued on purpose. "not-evaluated" is not a failure — a version
    # nobody gated did not fail its gate — but it is emphatically not a pass either, and
    # a two-valued flag forces the display to call it one of them. The UI reads this.
    if not fp32_eval:
        return {**GateVerdict(False, None, None, None,
                              "no FP32 evaluation was recorded for this run").to_dict(),
                "state": "not-evaluated"}
    if not int8_eval:
        fp_map = normalize_metrics(fp32_eval).get("map50")
        return {**GateVerdict(
            passed=False, fp32_map=fp_map, int8_map=None, delta=None,
            reason=("INT8 not evaluated — the compile quantizes but does not measure the "
                    "quantized model, so there is nothing to compare. NOT a pass."),
        ).to_dict(), "state": "not-evaluated"}
    verdict = gate_check(fp32_eval, int8_eval, max_map_drop=max_map_drop)
    return {**verdict.to_dict(), "state": "pass" if verdict.passed else "fail"}


def _load(src: dict[str, Any] | str | Path) -> dict[str, Any]:
    if isinstance(src, (str, Path)):
        return json.loads(Path(src).read_text())
    return dict(src)
