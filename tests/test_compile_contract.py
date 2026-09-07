"""The compile form and the compile pipeline must speak one vocabulary.

This is the test whose absence let the worst defect in the repo ship. The New-run
form sent the schema's compile keys — `optimization_level`, `max_proposals_per_class`
and friends — while `train_for_run.py` read a private second vocabulary of
`opt_level`, `max_per_class`, `wheel_key`. Nothing connected them, so:

  * `wheel_key` was never sent, the pipeline raised, a blanket handler logged the
    failure as a `warn`, and the run still finalised `succeeded`;
  * the level-2 quantization control was inert even when a wheel was supplied;
  * four more controls reached no consumer at all.

Every one of those is invisible from the outside: the checkbox is on by default and
the product's headline claim is that it compiles to a Hailo `.hef`. A green suite
never noticed, because no test asserted the two ends agreed.

    pytest tests/test_compile_contract.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = REPO_ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from sack_train_ml import contract  # noqa: E402
import train_for_run  # noqa: E402


# --------------------------------------------------------------------------------
# The load-bearing one.
# --------------------------------------------------------------------------------

def test_every_compile_field_reaches_a_consumer():
    """Each `form=compile, category=field` key must be one the pipeline consumes.

    A field the pipeline does not read is a control that silently does nothing —
    which is exactly what `calibration_set`, `input_conversion`, `compile_seed` and
    `diagnostics` were. If a new field is genuinely not consumable yet, it belongs in
    `category: "refused"` with a reason, not in `field`.
    """
    schema_fields = {p["key"] for p in contract.params("compile", "field")}
    consumed = set(train_for_run._COMPILE_ARG)
    orphaned = schema_fields - consumed
    assert not orphaned, (
        "compile fields the pipeline never reads — each would render as a live "
        f"control that changes nothing: {sorted(orphaned)}"
    )


def test_the_pipeline_reads_nothing_the_schema_does_not_offer():
    """The mirror image: a pipeline argument nobody can set is dead weight, and it
    hides the fact that its default is the only value ever used."""
    schema_fields = {p["key"] for p in contract.params("compile", "field")}
    unreachable = set(train_for_run._COMPILE_ARG) - schema_fields
    assert not unreachable, (
        f"pipeline reads compile keys the form cannot send: {sorted(unreachable)}"
    )


def test_the_form_payload_survives_the_pipeline():
    """Simulate what the form actually posts and prove the pipeline accepts it.

    The form sends `compile_hef` plus every compile field. Before the fix this raised
    on a missing `wheel_key`; the raise was then swallowed into a warning.
    """
    payload = {"compile_hef": True, **contract.defaults("compile")}
    kwargs = train_for_run.compile_kwargs(payload)
    assert kwargs["opt_level"] == 0
    assert kwargs["max_per_class"] == 50
    assert kwargs["calib_n"] == 512
    assert kwargs["scores_th"] == pytest.approx(0.20)
    assert kwargs["iou_th"] == pytest.approx(0.70)


# --------------------------------------------------------------------------------
# Refuse, never ignore.
# --------------------------------------------------------------------------------

def test_unknown_compile_keys_are_refused_not_ignored():
    """Ignoring an unrecognised key is how a control comes to do nothing while
    looking live. The refusal must name the offending key."""
    with pytest.raises(ValueError) as exc:
        train_for_run.compile_kwargs({"compile_hef": True, "wheel_key": "tools/x.whl"})
    assert "wheel_key" in str(exc.value)


def test_missing_keys_resolve_to_the_schema_default_not_a_second_copy():
    """A submitter who leaves a key out must get the value the form displayed."""
    kwargs = train_for_run.compile_kwargs({"compile_hef": True})
    assert kwargs == train_for_run.compile_kwargs(
        {"compile_hef": True, **contract.defaults("compile")}
    )


def test_every_refused_compile_param_says_why():
    """`refused` is only honest if the reason names the mechanism. A refusal with no
    reason is a disabled control, which is the thing this project keeps banning."""
    refused = contract.params("compile", "refused")
    assert refused, "expected the compile form to refuse at least one parameter"
    for p in refused:
        help_text = p.get("help", "")
        assert len(help_text) > 40, f"{p['key']}: refusal reason is too thin to act on"


# --------------------------------------------------------------------------------
# The wheel, and the pin behind it.
# --------------------------------------------------------------------------------

def test_the_dfc_wheel_is_named_by_the_pin_not_typed_per_run():
    key = contract.dfc_wheel_key()
    pinned = contract.pinned_versions()["dfc"]
    assert pinned in key, f"wheel key {key!r} does not carry the pinned DFC {pinned}"
    assert key.startswith("tools/hailo/"), "the gated wheel lives under the private tools/ prefix"
    assert key.endswith(".whl")


def test_the_wheel_key_matches_the_one_that_used_to_work():
    """The previous form shipped a working default. The derived key must reproduce it
    exactly, or this fix silently points the compile at a wheel that is not staged."""
    assert contract.dfc_wheel_key() == (
        "tools/hailo/hailo_dataflow_compiler-3.33.1-py3-none-linux_x86_64.whl"
    )


# --------------------------------------------------------------------------------
# A requested compile that did not happen is not a success.
# --------------------------------------------------------------------------------

class _StubClient:
    def __init__(self) -> None:
        self.steps: list[tuple] = []

    def log_step(self, *a, **k) -> None:
        self.steps.append(a)


def test_compile_not_requested_is_not_an_error():
    class _Cfg:
        compile_options: dict = {}

    assert train_for_run._maybe_compile_hef(
        config=_Cfg(), client=_StubClient(), run_id="r", semver="1.0.0-r",
        onnx_path=Path("/nonexistent.onnx"), onnx_sha="deadbeef",
        dataset_yaml=Path("/nonexistent.yaml"), save_dir=Path("/tmp"),
        git_sha=None, uploads={},
    ) is None


def test_a_failed_compile_returns_a_reason_rather_than_passing_silently():
    """The old code logged a warning and returned None, so a run with no `.hef`
    finalised `succeeded` and looked identical to one that compiled. The reason string
    is what `main()` carries into `finalize_run(status="failed")`."""
    class _Cfg:
        compile_options = {"compile_hef": True, "definitely_not_a_real_key": 1}
        classes = ["person", "sack"]
        export_options: dict = {}

    reason = train_for_run._maybe_compile_hef(
        config=_Cfg(), client=_StubClient(), run_id="r", semver="1.0.0-r",
        onnx_path=Path("/nonexistent.onnx"), onnx_sha="deadbeef",
        dataset_yaml=Path("/nonexistent.yaml"), save_dir=Path("/tmp"),
        git_sha=None, uploads={},
    )
    assert isinstance(reason, str) and reason, "a failed compile must report why"
    assert "definitely_not_a_real_key" in reason
