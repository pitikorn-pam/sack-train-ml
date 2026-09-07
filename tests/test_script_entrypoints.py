"""A script that is not an entry point must not exit 0.

Three scripts printed "TODO: … scaffold only" and exited successfully. That is worse
than not existing: `python scripts/train_yolo.py` looked like a command that ran and did
nothing, and a Makefile target pointed at each of them. Six more targets did the same.

The repo's own rule is refuse with a reason and name the mechanism, and it applies to a
command line as much as to a form.

    pytest tests/test_script_entrypoints.py
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]

# Scripts that exist as signposts, not as commands.
NOT_ENTRY_POINTS = ["train_yolo.py", "export_onnx.py", "release_bundle.py"]


@pytest.mark.parametrize("name", NOT_ENTRY_POINTS)
def test_it_refuses_rather_than_succeeding_silently(name):
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / name)], capture_output=True, text=True)
    assert r.returncode != 0, f"{name} exited 0 — it looks like it worked"


@pytest.mark.parametrize("name", NOT_ENTRY_POINTS)
def test_it_says_where_the_real_thing_is(name):
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / name)], capture_output=True, text=True)
    message = r.stdout + r.stderr
    assert "not an entry point" in message, f"{name} does not say what it is"
    assert "lives at" in message, f"{name} does not say where the real thing is"
    assert "TODO" not in message, f"{name} still says TODO, which promises a future it does not have"


def test_no_make_recipe_only_echoes_todo():
    """Six did. `make train` printed a TODO and returned success.

    Scoped to recipe lines — the tab-indented commands — rather than the whole file,
    because the comment explaining why those targets are gone is worth keeping and
    necessarily contains the word.
    """
    recipes = [
        line for line in (ROOT / "Makefile").read_text().splitlines()
        if line.startswith("\t")
    ]
    offenders = [line.strip() for line in recipes if "TODO" in line]
    assert not offenders, f"a make target that echoes TODO is a broken promise: {offenders}"


def test_the_makefile_targets_that_exist_name_a_real_command():
    makefile = (ROOT / "Makefile").read_text()
    for target in ("test-py", "test-web", "test-edge", "test-contract", "build", "verify-pin"):
        assert f"\n{target}:" in makefile, f"{target} is documented in help but not defined"
