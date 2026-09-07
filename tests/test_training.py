"""The metric callback is the wire that once discarded 197 finished epochs.

It carries a `# pragma: no cover - YOLO runtime` marker, which is exactly why it is
tested here: it needs no YOLO at all, only an object with `.epoch` and `.metrics`, and
it is the code whose failure mode is losing hours of finished GPU work to one 502.

    pytest tests/test_training.py
"""
from __future__ import annotations

import math

import pytest

from sack_train_ml.contracts import RunConfig
from sack_train_ml.training import (
    DEFAULT_TRAIN_KWARGS,
    _coerce_batch,
    _is_number,
    build_train_kwargs,
    make_metric_callback,
)


class _Trainer:
    def __init__(self, epoch=0, metrics=None):
        self.epoch = epoch
        self.metrics = metrics if metrics is not None else {}


class _Client:
    def __init__(self, fail_metrics=False, fail_steps=False):
        self.metrics: list = []
        self.steps: list = []
        self._fail_metrics = fail_metrics
        self._fail_steps = fail_steps

    def log_metrics(self, run_id, rows):
        if self._fail_metrics:
            raise RuntimeError("502 from the callback endpoint")
        self.metrics.append((run_id, rows))

    def log_step(self, *a, **k):
        if self._fail_steps:
            raise RuntimeError("the same endpoint is still down")
        self.steps.append((a, k))


# --------------------------------------------------------------------------
# batch coercion — ultralytics stopped accepting "auto"
# --------------------------------------------------------------------------

@pytest.mark.parametrize("value,expected", [
    ("auto", -1), ("AUTO", -1), (" auto ", -1), ("-1", -1), ("", -1),
    ("16", 16), ("0.5", 0.5), ("nonsense", -1), (8, 8), (-1, -1),
])
def test_batch_is_translated_to_ultralytics_sentinel(value, expected):
    assert _coerce_batch(value) == expected


# --------------------------------------------------------------------------
# build_train_kwargs
# --------------------------------------------------------------------------

def _config(**over):
    base = dict(source_weights="yolo11s.pt", dataset="d.yaml", classes=["person", "sack"],
                input_size=[640, 640, 3], task="detection", output_kind="detection-boxes")
    base.update(over)
    return RunConfig.from_dict(base)


def test_the_optimizer_is_pinned_by_default():
    """ultralytics' optimizer="auto" selects an experimental optimizer that crashed a
    run at epoch 1. The pin is the fix, and it must survive."""
    assert DEFAULT_TRAIN_KWARGS["optimizer"] == "AdamW"
    kw = build_train_kwargs(_config(), "d.yaml", "/tmp/p", "r")
    assert kw["optimizer"] == "AdamW"


def test_a_run_can_still_override_a_default():
    kw = build_train_kwargs(_config(hyperparameters={"epochs": 250, "optimizer": "SGD"}),
                            "d.yaml", "/tmp/p", "r")
    assert kw["epochs"] == 250 and kw["optimizer"] == "SGD"


def test_batch_is_coerced_even_when_it_came_from_the_run():
    kw = build_train_kwargs(_config(hyperparameters={"batch": "auto"}), "d.yaml", "/tmp/p", "r")
    assert kw["batch"] == -1


def test_imgsz_follows_a_square_input_size():
    kw = build_train_kwargs(_config(input_size=[960, 960, 3]), "d.yaml", "/tmp/p", "r")
    assert kw["imgsz"] == 960


def test_a_non_square_input_size_does_not_silently_pick_one_side():
    """Choosing width over height, or the reverse, would train at a size nobody asked
    for. Leaving the default is the honest outcome."""
    kw = build_train_kwargs(_config(input_size=[1280, 720, 3]), "d.yaml", "/tmp/p", "r")
    assert kw["imgsz"] == DEFAULT_TRAIN_KWARGS["imgsz"]


def test_paths_are_strings_because_ultralytics_rejects_path_objects(tmp_path):
    kw = build_train_kwargs(_config(), tmp_path / "d.yaml", tmp_path / "proj", "run-1")
    assert isinstance(kw["data"], str) and isinstance(kw["project"], str)
    assert kw["name"] == "run-1"


# --------------------------------------------------------------------------
# the metric callback
# --------------------------------------------------------------------------

def test_it_streams_the_numeric_metrics_and_appends_progress():
    client = _Client()
    make_metric_callback(client, "run-1", total_epochs=10)(
        _Trainer(epoch=4, metrics={"metrics/mAP50(B)": 0.91, "lr/pg0": 0.001})
    )
    _, rows = client.metrics[-1]
    by_name = {r["name"]: r["value"] for r in rows}
    assert by_name["metrics/mAP50(B)"] == pytest.approx(0.91)
    assert by_name["progress"] == pytest.approx(50.0)


def test_non_numeric_and_nan_metrics_are_dropped_not_sent():
    """ultralytics' metrics dict carries strings and occasional NaNs; a NaN reaches the
    database as null and charts as a hole, and a string raises on float()."""
    client = _Client()
    make_metric_callback(client, "run-1", 10)(
        _Trainer(epoch=0, metrics={"good": 1.0, "text": "val", "nan": float("nan")})
    )
    names = {r["name"] for r in client.metrics[-1][1]}
    assert "good" in names and "text" not in names and "nan" not in names


def test_progress_is_reported_even_when_there_are_no_metrics_yet():
    client = _Client()
    make_metric_callback(client, "run-1", 4)(_Trainer(epoch=0, metrics={}))
    assert [r["name"] for r in client.metrics[-1][1]] == ["progress"]


def test_progress_reaches_100_on_the_last_epoch():
    client = _Client()
    make_metric_callback(client, "run-1", 3)(_Trainer(epoch=2))
    assert client.metrics[-1][1][-1]["value"] == pytest.approx(100.0)


def test_zero_total_epochs_does_not_divide_by_zero():
    client = _Client()
    make_metric_callback(client, "run-1", 0)(_Trainer(epoch=0))  # must not raise


def test_a_dead_endpoint_does_not_abort_training(capsys):
    """The failure this exists to prevent: one 502 escaping through ultralytics'
    callback loop killed a run mid-epoch and discarded 197 finished epochs."""
    client = _Client(fail_metrics=True)
    make_metric_callback(client, "run-1", 10)(_Trainer(epoch=196))  # must not raise
    out = capsys.readouterr().out
    assert "metric stream failed at epoch 196" in out
    assert "training continues" in out


def test_the_fallback_log_cannot_take_the_run_down_either():
    """The old code was doubly exposed: the handler for a failed log_metrics called
    log_step, which hits the same dead endpoint."""
    client = _Client(fail_metrics=True, fail_steps=True)
    make_metric_callback(client, "run-1", 10)(_Trainer(epoch=5))  # must not raise


def test_a_trainer_with_no_metrics_attribute_is_survivable():
    class _Bare:
        epoch = 3

    client = _Client()
    make_metric_callback(client, "run-1", 10)(_Bare())
    assert client.metrics, "progress should still have been reported"


@pytest.mark.parametrize("value,ok", [
    (1, True), (0.5, True), ("0.5", True), (float("nan"), False),
    (None, False), ("abc", False), ([1], False),
])
def test_is_number_rejects_nan_as_well_as_non_numbers(value, ok):
    assert _is_number(value) is ok
