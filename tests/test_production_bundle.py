"""The dev-only auth bypass must not survive a production build.

`apps/web/src/App.tsx` renders the app shell without a session when `?preview=1` is
present, gated on `import.meta.env.DEV`. Vite replaces that with the literal `false` in
a production build, so the branch is dead-code-eliminated — which makes "this cannot
ship" true, but only as long as nobody changes the guard.

A comment saying it cannot ship is not a check. This is.

    pytest tests/test_production_bundle.py
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"


@pytest.fixture(scope="module")
def bundle() -> str:
    if shutil.which("npm") is None:
        pytest.skip("npm is not installed")
    if not (WEB / "node_modules").is_dir():
        pytest.skip("apps/web dependencies are not installed — run npm install there")
    r = subprocess.run(["npm", "run", "build"], cwd=str(WEB), capture_output=True,
                       text=True, timeout=600)
    assert r.returncode == 0, f"the production build failed:\n{r.stderr[-1500:]}"
    files = list((WEB / "dist" / "assets").glob("*.js"))
    assert files, "the build produced no javascript"
    return "\n".join(f.read_text(errors="ignore") for f in files)


def test_the_preview_bypass_is_absent_from_the_production_bundle(bundle):
    """`?preview=1` skips the sign-in screen. If the string survives minification, the
    guard is no longer DEV-only and the bypass shipped."""
    assert '"preview"' not in bundle and "'preview'" not in bundle, (
        "the preview parameter appears in the production bundle — the dev-only auth "
        "bypass may have shipped"
    )


def test_the_build_carries_no_service_role_token(bundle):
    """A Supabase service key is a JWT whose payload names the role. Search for the
    VALUE, not the name: the Colab checklist legitimately tells the operator to set
    SUPABASE_SERVICE_ROLE_KEY, and a test that trips on the instruction is a test
    everyone learns to ignore.
    """
    import base64
    import re

    for token in re.findall(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+", bundle):
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        try:
            claims = base64.urlsafe_b64decode(payload).decode("utf-8", "ignore")
        except Exception:
            continue
        assert '"service_role"' not in claims, (
            "a service-role JWT is embedded in the browser bundle — the browser is the "
            "least trusted place a key could be"
        )


def test_the_build_embeds_no_secret_VALUE(bundle):
    """Again the value, not the name. The bundle legitimately mentions
    TRAINING_CALLBACK_SECRET inside the Colab setup checklist, which is a instruction to
    the operator rather than a leak."""
    import re

    leaks = re.findall(r"TRAINING_CALLBACK_SECRET\s*[:=]\s*[\"\'][A-Za-z0-9+/=_-]{16,}[\"\']", bundle)
    assert not leaks, f"a callback-secret value appears in the bundle: {leaks}"
