"""The Python result and the TypeScript type that reads it must agree on names.

D-20 cost an entire working, tested feature: the backend returned
`detection_diagnostics`, the manifest used that name, `tests/test_lab_api_contract.py`
asserted it — and the UI read `result.diagnostics`, so every successful run rendered
"DETECTOR DIAGNOSTICS LOCKED". TypeScript cannot catch this. The type is a *claim*
about a runtime shape that arrives as JSON, and a claim nobody checks is a comment.

This is the check. It reads the TypeScript declaration as text — no bundler, no node —
and compares its keys against the dataclass the server actually serialises with
`asdict`. It is deliberately one-directional: the TS type may omit fields it does not
use, but it must not *invent* one, because an invented key reads as `undefined` at
runtime and renders as an empty panel rather than an error.

    pytest tests/test_lab_result_shape.py
"""
from __future__ import annotations

import dataclasses
import re
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
WEBUI = REPO_ROOT / "webui"
if str(WEBUI) not in sys.path:
    sys.path.insert(0, str(WEBUI))

LAB_API_TS = REPO_ROOT / "apps" / "web" / "src" / "lib" / "labApi.ts"


def _ts_type_keys(source: str, name: str) -> set[str]:
    """Keys declared in `export type <name> = { ... }`, ignoring comments."""
    m = re.search(rf"export type {name} = \{{", source)
    assert m, f"type {name} not found in labApi.ts"
    depth, i = 0, m.end() - 1
    while i < len(source):
        if source[i] == "{":
            depth += 1
        elif source[i] == "}":
            depth -= 1
            if depth == 0:
                break
        i += 1
    body = source[m.end() : i]
    body = re.sub(r"/\*[\s\S]*?\*/", "", body)          # block comments
    body = re.sub(r"//[^\n]*", "", body)                 # line comments
    # Strip nested object literals repeatedly, innermost first, so only the type's own
    # keys survive. One pass is not enough — a nested object containing another one
    # leaks its children, which is how the first version of this test produced eight
    # false positives and had to be fixed before it could be trusted.
    while True:
        stripped = re.sub(r"\{[^{}]*\}", "", body)
        if stripped == body:
            break
        body = stripped
    return set(re.findall(r"^\s*([a-z_][a-z0-9_]*)\??\s*:", body, re.M | re.I))


@pytest.fixture(scope="module")
def ts_source() -> str:
    return LAB_API_TS.read_text()


# Fields `apps/api/lab_server.py::_store_result` wraps around the dataclass.
API_ADDED = {
    "manifest", "run_id", "video_id", "video_url", "schema_version", "config",
    "output_video_url", "job_id", "model", "input",
}

# Fields the TypeScript type declares that NOTHING sends. Each one reads as `undefined`
# at runtime, which renders as an empty or LOCKED panel rather than an error — the same
# failure mode as the `diagnostics` key, just not yet noticed by anyone.
#
# This list is a ratchet, not permission. It exists so the test can fail on a NEW
# invention today rather than waiting for the cleanup. Removing an entry here after
# removing it from the type is always correct; adding one needs a reason.
#
#   capabilities / capability_details  — read as an optional fallback at Lab.tsx:558;
#                                        the real source is the health endpoint.
#   paths / run / trail / trails       — read and always undefined. `trails` is D-25:
#                                        the backend never advertises or returns them.
#   artifacts / provenance /           — declared, never read, never sent.
#   unsupported_capabilities
KNOWN_UNIMPLEMENTED = {
    "artifacts", "capabilities", "capability_details", "paths",
    "provenance", "run", "trail", "trails", "unsupported_capabilities",
}


def test_labresult_ts_invents_no_new_field_the_backend_does_not_send(ts_source):
    import lab_core

    backend = {f.name for f in dataclasses.fields(lab_core.LabResult)}
    declared = _ts_type_keys(ts_source, "LabResult")
    invented = declared - backend - API_ADDED - KNOWN_UNIMPLEMENTED
    assert not invented, (
        "labApi.ts declares LabResult fields the backend never sends — each renders as "
        f"undefined and shows an empty or LOCKED panel rather than an error: {sorted(invented)}"
    )


def test_the_unimplemented_list_does_not_quietly_grow_stale(ts_source):
    """A ratchet only works if it can tighten. If a field on the list is no longer
    declared — because someone removed it, or the backend started sending it — the list
    must shrink too, or it becomes a place where real problems hide."""
    import lab_core

    backend = {f.name for f in dataclasses.fields(lab_core.LabResult)}
    declared = _ts_type_keys(ts_source, "LabResult")
    stale = {k for k in KNOWN_UNIMPLEMENTED if k not in declared or k in backend}
    assert not stale, (
        "these are on the known-unimplemented list but no longer belong there — "
        f"remove them from the list: {sorted(stale)}"
    )


def test_the_diagnostics_key_is_the_one_the_backend_actually_uses(ts_source):
    """The specific regression. Named on its own so a failure says what broke."""
    import lab_core

    assert "detection_diagnostics" in {f.name for f in dataclasses.fields(lab_core.LabResult)}
    assert "detection_diagnostics" in _ts_type_keys(ts_source, "LabResult")
    assert "diagnostics" not in _ts_type_keys(ts_source, "LabResult")


def test_summary_buckets_shown_are_buckets_the_backend_fills(ts_source):
    """`dropped` was counted into `total` and never displayed, so the arithmetic on
    screen did not close: total exceeded the sum of the visible buckets."""
    declared = _ts_type_keys(ts_source, "LabSummary")
    for bucket in ("confirmed", "flagged", "dropped", "recovered", "excluded", "total"):
        assert bucket in declared, f"LabSummary does not declare {bucket}"
