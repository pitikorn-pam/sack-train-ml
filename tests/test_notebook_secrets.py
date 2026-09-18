"""The Colab notebook must set every secret the pipeline it launches will demand.

This exists because of a real, quiet failure: `_call_callback` was made to require an
HMAC signature (the service-role claim it used to accept was never verified), but
`train_run.ipynb` still prompted for the service-role key alone. A run then trained
to completion and saved weights while every metric, every step log and the closing
`finalize_run` was refused — one warning per epoch, no error, and a dashboard showing
the run stuck at "running" with no version row.

A notebook cannot be imported, so nothing in the test suite could notice. These tests
read it as JSON instead, which is crude but is the only thing standing between a
future required env var and another silent half-run.

    pytest tests/test_notebook_secrets.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
NOTEBOOK = REPO / "notebooks" / "train_run.ipynb"
CLIENT = REPO / "src" / "sack_train_ml" / "supabase_client.py"


@pytest.fixture(scope="module")
def notebook_source() -> str:
    assert NOTEBOOK.exists(), f"the training notebook moved: {NOTEBOOK}"
    nb = json.loads(NOTEBOOK.read_text())
    return "\n".join("".join(c.get("source", [])) for c in nb["cells"])


@pytest.fixture(scope="module")
def client_source() -> str:
    assert CLIENT.exists(), f"the registry client moved: {CLIENT}"
    return CLIENT.read_text()


def test_notebook_is_valid_and_code_cells_are_well_formed():
    nb = json.loads(NOTEBOOK.read_text())
    assert nb["nbformat"] == 4
    for i, cell in enumerate(nb["cells"]):
        assert {"cell_type", "source", "metadata"} <= set(cell), f"cell {i} is malformed"
        if cell["cell_type"] == "code":
            assert "outputs" in cell and "execution_count" in cell, f"code cell {i} is malformed"


def test_notebook_sets_every_env_var_the_client_requires(notebook_source, client_source):
    """Every os.environ key the client reads must be set somewhere in the notebook.

    Derived from the client rather than hardcoded, so adding a new required variable
    fails here instead of thirty minutes into a GPU run.
    """
    required = set(re.findall(r'os\.environ\["([A-Z_]+)"\]', client_source))
    required |= set(re.findall(r'os\.environ\.get\("([A-Z_]+)"', client_source))
    assert required, "read no env vars out of supabase_client.py — the regex is stale"

    missing = [v for v in sorted(required) if f"os.environ['{v}']" not in notebook_source
               and f'os.environ["{v}"]' not in notebook_source]
    assert not missing, (
        f"supabase_client.py reads {missing} but train_run.ipynb never sets it. A run "
        f"launched from this notebook would fail on that variable partway through."
    )


def test_notebook_prompts_for_the_callback_secret(notebook_source):
    assert "TRAINING_CALLBACK_SECRET" in notebook_source
    assert "getpass('TRAINING_CALLBACK_SECRET: ')" in notebook_source, (
        "the secret must be prompted, not hardcoded — this notebook is committed"
    )


def test_notebook_refuses_an_empty_callback_secret(notebook_source):
    """An empty value is the exact shape of the original bug: everything looks set, and
    every callback is refused."""
    assert "assert TRAINING_CALLBACK_SECRET.strip()" in notebook_source


def test_no_secret_value_is_committed_in_the_notebook(notebook_source):
    """getpass keeps values out of the file; a pasted value would be a long literal.

    Matches a JWT by its three-segment shape, not by the prefix `eyJ` alone — the
    notebook legitimately contains `startswith('eyJ')` as a malformed-key check, and a
    first version of this test flagged that validation as the secret it was validating.
    """
    jwt = re.search(r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}",
                    notebook_source)
    assert not jwt, f"a JWT looks committed in the notebook: {jwt.group()[:16]}..."

    for literal in re.findall(r"""=\s*['"]([A-Za-z0-9_\-+/=]{32,})['"]""", notebook_source):
        pytest.fail(f"a long literal is assigned in the notebook, looks like a secret: "
                    f"{literal[:12]}...")


def test_the_callback_still_requires_a_signature(client_source):
    """If the HMAC requirement is ever relaxed, this file's reason for existing changes
    and the notebook prompt should be revisited rather than left as cargo."""
    assert "TRAINING_CALLBACK_SECRET is not set" in client_source
    assert "hmac" in client_source.lower()
