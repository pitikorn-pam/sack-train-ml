"""The schema must keep describing reality.

Argument defaults move between ultralytics releases — the Muon incident lived in
exactly one of them — so a schema nobody checks becomes a lie quietly. These tests
are the mechanism the contract depends on (issue 05); without them the "single
source of truth" is only a claim.

    pytest tests/test_contract.py
"""
from __future__ import annotations

import pytest

from sack_train_ml import contract


def test_schema_loads_and_has_both_forms():
    assert contract.params("train"), "no train parameters in the schema"
    assert contract.params("compile"), "no compile parameters in the schema"


def test_every_param_carries_what_the_form_needs():
    """Category and help are part of the schema, not the markup — the same wording has
    to be true in the form, in the pre-launch preview, and in the run's record."""
    missing = [
        f"{p['key']}: {', '.join(k for k in ('label', 'help', 'category', 'form') if not p.get(k))}"
        for p in contract.params()
        if not all(p.get(k) for k in ("label", "help", "category", "form"))
    ]
    assert not missing, "parameters missing contract fields:\n  " + "\n  ".join(missing)


def test_categories_are_known():
    allowed = {"field", "advanced", "derived", "refused"}
    bad = [f"{p['key']}={p['category']}" for p in contract.params() if p["category"] not in allowed]
    assert not bad, f"unknown categories: {bad}"


def test_every_field_has_a_default():
    """A field without a default has an invisible one, which is the disease."""
    missing = [p["key"] for p in contract.params(category="field") if p.get("default") is None]
    assert not missing, f"fields with no stated default: {missing}"


def test_optimizer_is_pinned_and_auto_is_discouraged():
    """The incident this whole contract was built around."""
    opt = next(p for p in contract.params("train") if p["key"] == "optimizer")
    assert opt["default"] == "AdamW", "optimizer must stay pinned"
    assert "auto" in opt.get("discouraged", []), "'auto' must be marked not recommended"


@pytest.mark.skipif(
    pytest.importorskip("ultralytics", reason="ultralytics not installed") is None,
    reason="ultralytics not installed",
)
def test_schema_agrees_with_installed_ultralytics():
    """Every train key must exist upstream, and every default must match unless the
    divergence is a recorded decision."""
    import ultralytics

    problems = contract.check_against_ultralytics()
    assert not problems, "schema has drifted from ultralytics:\n  " + "\n  ".join(problems)

    # The check is only as strong as the version present. Passing against a version the
    # contract does not pin proves the schema matches *that* one, not the pinned one —
    # say so out loud rather than letting a green tick imply more than it earned.
    pin_problems = contract.check_toolchain_pin()
    if pin_problems:
        import warnings
        warnings.warn(
            f"conformance ran against ultralytics {ultralytics.__version__}, not the pinned "
            f"version — {pin_problems[0]}. Re-run after `pip install -e .` to check the pin.",
            stacklevel=1,
        )


# ---------------------------------------------------------------------------
# The escape hatch is the one surface no earlier layer can validate.
# ---------------------------------------------------------------------------

def test_known_hyperparameters_pass():
    assert contract.check_run_hyperparameters({"epochs": 100, "lr0": 0.001, "mosaic": 0.7}) == []


def test_our_own_keys_are_not_reported_as_unknown():
    # `classes` is a contract-level concept the trainer never sees.
    assert contract.check_run_hyperparameters({"classes": ["person", "sack"]}) == []


def test_a_typo_is_caught_before_the_run_burns_a_session():
    """`mosiac` passes the browser (valid JSON, not a refused key) and passes the edge
    function (which validates only declared fields), then reaches model.train(**kwargs).
    ultralytics does raise on it — after Colab has booted and the dataset has downloaded."""
    problems = contract.check_run_hyperparameters({"mosiac": 0.7})
    assert len(problems) == 1
    assert "mosiac" in problems[0]


def test_the_message_names_the_version_it_checked_against():
    import ultralytics

    problems = contract.check_run_hyperparameters({"definitely_not_a_key": 1})
    assert ultralytics.__version__ in problems[0]


def test_empty_hyperparameters_are_fine():
    assert contract.check_run_hyperparameters({}) == []
