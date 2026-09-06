"""The parameter contract, read by the pipeline.

Third reader of `contracts/param-schema.json`, alongside the web form and the
`start-training` edge function. Imported, never copied — a copy is what drifts, and
this repo has already paid for that once with a stale notebook that cost a wrong
diagnosis.

This layer owns the checks the others cannot make: whether the *installed* ultralytics
accepts a value, and whether the defaults the schema claims are the ones ultralytics
actually uses. Static checks (keys, ranges, cross-field rules) belong to the edge
function, which is the choke point every run passes through — see
`.scratch/train-param-contract/issues/04`.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO_ROOT / "contracts" / "param-schema.json"


@lru_cache(maxsize=1)
def schema() -> dict[str, Any]:
    return json.loads(SCHEMA_PATH.read_text())


def params(form: str | None = None, category: str | None = None) -> list[dict[str, Any]]:
    return [
        p for p in schema()["params"]
        if (form is None or p["form"] == form) and (category is None or p["category"] == category)
    ]


def defaults(form: str) -> dict[str, Any]:
    """The values this project fills in when the submitter names none."""
    return {p["key"]: p.get("default") for p in params(form, "field")}


def pinned_versions() -> dict[str, str]:
    return dict(schema()["toolchain"])


class ContractError(RuntimeError):
    """The schema and the installed toolchain disagree."""


def check_against_ultralytics() -> list[str]:
    """Compare the schema's train parameters with what ultralytics actually defines.

    Returns a list of problems; empty means the schema still describes reality. This is
    the only thing that keeps the contract true months from now, because argument
    defaults do move between releases — the Muon incident lived in exactly one of them.

    Two failure kinds are reported:
      * a key we claim that ultralytics does not have — the form would offer a control
        that silently does nothing;
      * a default we state that differs from the installed one — the pre-launch preview
        would show a value the run does not use, which is the whole disease.
    """
    from ultralytics.utils import DEFAULT_CFG_DICT

    problems: list[str] = []

    # Keys that are ours rather than ultralytics'. `imgsz` and friends are real
    # ultralytics args; these are contract-level concepts the trainer never sees.
    OURS = {"classes"}

    for p in params("train"):
        key = p["key"]
        if key in OURS or p["category"] == "derived":
            continue
        if key not in DEFAULT_CFG_DICT:
            problems.append(f"{key}: in the schema but not in ultralytics' DEFAULT_CFG_DICT")
            continue
        if p["category"] == "refused":
            continue
        ours, theirs = p.get("default"), DEFAULT_CFG_DICT[key]
        if _normalise(ours) != _normalise(theirs) and not _deliberate_override(key):
            problems.append(
                f"{key}: schema default {ours!r} but ultralytics uses {theirs!r} "
                f"(intended? add it to _deliberate_override)"
            )
    return problems


# Defaults we intentionally differ on, with the reason. Anything not listed here that
# diverges is a drift, not a decision.
_OVERRIDES = {
    "optimizer": "pinned to AdamW; ultralytics' 'auto' selects an experimental optimizer",
    "patience": "20 rather than 100 — a small dataset stops improving long before that",
    "lr0": "0.001 suits AdamW fine-tuning from a pretrained checkpoint",
    "save_period": "checkpoint regularly because Colab sessions die mid-run",
    "batch": "'auto' is this project's word for ultralytics' -1 sentinel",
    "epochs": "100 is this project's starting point, not ultralytics' default",
    "deterministic": "kept true explicitly so a seed actually buys reproducibility",
    "freeze": "exposed as 'none' rather than null for the form",
}


def _deliberate_override(key: str) -> bool:
    return key in _OVERRIDES


def _normalise(v: Any) -> Any:
    if isinstance(v, str) and v.lower() in {"true", "false"}:
        return v.lower() == "true"
    if isinstance(v, str) and v == "none":
        return None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    return v


def check_toolchain_pin() -> list[str]:
    """The installed ultralytics must be the one the contract names."""
    import ultralytics

    installed = getattr(ultralytics, "__version__", "unknown")
    pinned = pinned_versions().get("ultralytics")
    if pinned and installed != pinned:
        return [f"ultralytics {installed} installed, contract pins {pinned}"]
    return []
