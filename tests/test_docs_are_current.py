"""The countable claims in the README must match the repository.

Documentation drifts silently, and a v1.0.0 reviewer opens the README first. Every
number here was wrong at once: "7 migrations" when there were eleven, "10 edge
functions" when there were thirteen, "pytest skeleton" when the suite had grown past
eighty, "magic link" for a password form, and "hailomz CLI" for a compile that runs the
DFC ClientRunner in a subprocess venv.

Only mechanically checkable claims are tested. Prose is not, and this file does not
pretend otherwise — but a number in a document is a claim about the filesystem, and the
filesystem can answer.

    pytest tests/test_docs_are_current.py
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"


@pytest.fixture(scope="module")
def readme() -> str:
    return README.read_text()


def _migration_count() -> int:
    return len(list((ROOT / "supabase" / "migrations").glob("*.sql")))


def _edge_function_count() -> int:
    fns = ROOT / "supabase" / "functions"
    return len([d for d in fns.iterdir() if d.is_dir() and not d.name.startswith("_")])


def test_the_readme_states_the_real_migration_count(readme):
    n = _migration_count()
    assert re.search(rf"\b{n} (SQL files|migrations)\b", readme), (
        f"README does not mention the real migration count ({n}); it drifts every time "
        "one is added, which is how '7 migrations' survived four of them"
    )


def test_the_readme_states_the_real_edge_function_count(readme):
    n = _edge_function_count()
    assert re.search(rf"\b{n}\b", readme), f"README does not mention the real edge function count ({n})"


def test_the_readme_does_not_still_claim_a_pytest_skeleton(readme):
    assert "pytest skeleton" not in readme, (
        "the suite is well past a skeleton; the phrase invites a reviewer to skip it"
    )


def test_the_readme_describes_the_auth_that_exists(readme):
    auth = (ROOT / "apps" / "web" / "src" / "components" / "Auth.tsx").read_text()
    if "signInWithPassword" in auth:
        assert "magic link" not in readme.lower(), (
            "README says magic link; Auth.tsx calls signInWithPassword"
        )


def test_the_readme_describes_the_compile_that_exists(readme):
    pipeline = (ROOT / "src" / "sack_train_ml" / "hailo_pipeline.py").read_text()
    if "hailomz" not in pipeline:
        assert "hailomz" not in readme, (
            "README credits the hailomz CLI; hailo_pipeline.py runs the DFC ClientRunner"
        )


def test_the_readme_layout_mentions_every_top_level_surface(readme):
    """The Lab is a whole user-facing surface with its own backend. It was absent from
    the layout entirely, which is how a reviewer would miss that it exists at all."""
    for surface in ("apps/api", "webui/", "contracts/", "DESIGN.md"):
        assert surface in readme, f"README's layout omits {surface}"
