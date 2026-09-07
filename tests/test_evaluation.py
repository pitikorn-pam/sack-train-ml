"""The FP32-vs-INT8 gate, and the metric names it depends on.

This module decides whether a quantized model is close enough to its float original to
ship. It had no test and no caller: the audit found `gate_check` referenced only by a
docstring. That combination is how a gate comes to be trusted without ever having been
run — and the INT8 investigation this repo spent days on is exactly the failure it
exists to catch.

    pytest tests/test_evaluation.py
"""
from __future__ import annotations

import json

import pytest

from sack_train_ml.evaluation import GateVerdict, gate_check, normalize_metrics


# --------------------------------------------------------------------------
# normalize_metrics — ultralytics' names are not the registry's
# --------------------------------------------------------------------------

def test_ultralytics_names_are_translated():
    out = normalize_metrics({
        "metrics/mAP50(B)": 0.91,
        "metrics/mAP50-95(B)": 0.72,
        "metrics/precision(B)": 0.88,
        "metrics/recall(B)": 0.83,
    })
    assert out == {"map50": 0.91, "map50_95": 0.72, "precision": 0.88, "recall": 0.83}


def test_already_canonical_names_pass_through():
    assert normalize_metrics({"map50": 0.5})["map50"] == 0.5


def test_non_numeric_values_are_dropped_rather_than_crashing():
    """ultralytics' results carry strings and objects beside the numbers, and a metric
    harvest that raised on the first of them would lose the whole run's evaluation."""
    out = normalize_metrics({"map50": 0.9, "speed": {"inference": 4.2}, "name": "val"})
    assert out == {"map50": 0.9}


def test_numeric_strings_are_accepted():
    assert normalize_metrics({"map50": "0.87"})["map50"] == pytest.approx(0.87)


def test_an_empty_result_is_empty_not_an_error():
    assert normalize_metrics({}) == {}


# --------------------------------------------------------------------------
# gate_check — the decision itself
# --------------------------------------------------------------------------

def test_a_small_drop_passes():
    v = gate_check({"map50": 0.90}, {"map50": 0.89})
    assert v.passed is True
    assert v.delta == pytest.approx(0.01)
    assert "OK" in v.reason


def test_a_large_drop_fails_and_says_by_how_much():
    v = gate_check({"map50": 0.90}, {"map50": 0.50})
    assert v.passed is False
    assert v.delta == pytest.approx(0.40)
    assert "FAIL" in v.reason and "0.4" in v.reason


def test_the_boundary_passes_rather_than_failing():
    """A delta exactly at the threshold is within it.

    Writing this test found the defect it now guards: 0.90 - 0.87 is
    0.030000000000000027 in binary floating point, so a drop of exactly 0.03 failed a
    gate whose limit is 0.03. A threshold the measurement cannot reach reads as a
    failed result, which is a lesson this repo has already paid for once.
    """
    v = gate_check({"map50": 0.90}, {"map50": 0.87}, max_map_drop=0.03)
    assert v.passed is True


def test_the_tolerance_cannot_admit_a_real_regression():
    """The fix must not become a loophole: anything past the threshold by more than
    floating-point noise still fails."""
    assert gate_check({"map50": 0.90}, {"map50": 0.8699}, max_map_drop=0.03).passed is False


def test_quantization_that_improves_the_metric_still_passes():
    """A negative delta is not a failure — INT8 occasionally scores higher on a small
    val set, and a gate that rejected it would block a shippable model."""
    v = gate_check({"map50": 0.85}, {"map50": 0.88})
    assert v.passed is True
    assert v.delta < 0


def test_a_missing_metric_fails_closed_and_names_the_reason():
    """This is the case the repo actually hit: the harvest collected only `fitness`, so
    map50 was absent from every eval file. The gate must refuse, not default to pass."""
    v = gate_check({"fitness": 0.6}, {"map50": 0.9})
    assert v.passed is False
    assert v.fp32_map is None
    assert "missing map50" in v.reason


def test_both_missing_also_fails_closed():
    assert gate_check({}, {}).passed is False


def test_it_reads_eval_files_from_disk(tmp_path):
    fp = tmp_path / "fp32.json"
    iq = tmp_path / "int8.json"
    fp.write_text(json.dumps({"metrics/mAP50(B)": 0.9}))
    iq.write_text(json.dumps({"metrics/mAP50(B)": 0.89}))
    v = gate_check(fp, iq)
    assert v.passed is True
    assert v.fp32_map == pytest.approx(0.9)


def test_the_verdict_serialises_for_the_registry():
    d = gate_check({"map50": 0.9}, {"map50": 0.89}).to_dict()
    assert set(d) == {"passed", "fp32_map", "int8_map", "delta", "reason"}
    json.dumps(d)  # must survive the round trip into metrics_summary.gate


def test_a_custom_threshold_is_honoured():
    strict = gate_check({"map50": 0.90}, {"map50": 0.88}, max_map_drop=0.01)
    lenient = gate_check({"map50": 0.90}, {"map50": 0.88}, max_map_drop=0.10)
    assert strict.passed is False and lenient.passed is True
