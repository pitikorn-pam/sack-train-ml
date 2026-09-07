"""The command-line tools, exercised as far as a machine without hardware can.

Three scripts were catalogued LIVE but "not exercised by any suite": an inference smoke
test, the DFC classification-activation probe, and the R2 staging helpers. None can be
run to completion here — they want a model, a Hailo virtualenv, or R2 credentials.

What CAN be checked is the part every user hits first and that breaks most often: does
`--help` work, does a missing required argument fail loudly rather than crashing on an
unbound name, and does a missing prerequisite produce a message rather than a traceback.
A tool that dies with `NameError` before printing its usage is broken for everyone,
credentials or not.

    pytest tests/test_cli_tools.py
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"

PY_TOOLS = ["test_inference.py", "probe_cls_activation.py"]
NODE_TOOLS = ["r2-put-tool.mjs", "r2-set-cors.mjs"]


def _run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=90,
                          cwd=str(ROOT), **kw)


# --------------------------------------------------------------------------
# --help is the contract with a first-time user
# --------------------------------------------------------------------------

@pytest.mark.parametrize("name", PY_TOOLS)
def test_help_works_and_exits_zero(name):
    r = _run([sys.executable, str(SCRIPTS / name), "--help"])
    assert r.returncode == 0, f"{name} --help failed:\n{r.stderr[-800:]}"
    assert "usage:" in r.stdout.lower(), f"{name} --help printed no usage"


@pytest.mark.parametrize("name", PY_TOOLS)
def test_help_names_the_arguments_it_needs(name):
    r = _run([sys.executable, str(SCRIPTS / name), "--help"])
    assert "--" in r.stdout, f"{name} --help lists no options"


def test_the_probe_refuses_without_its_required_onnx():
    """argparse must reject the missing argument before any Hailo import is attempted —
    otherwise the operator sees an ImportError about a virtualenv they were never told
    they needed."""
    r = _run([sys.executable, str(SCRIPTS / "probe_cls_activation.py")])
    assert r.returncode != 0
    combined = r.stdout + r.stderr
    assert "--onnx" in combined, "the refusal does not name the missing argument"
    assert "Traceback" not in combined, "a missing argument produced a traceback"


def test_the_inference_tool_refuses_with_no_model_and_no_input():
    """It takes a local model or a registry version, and something to run on. With
    neither it must say so rather than proceeding to an unbound variable."""
    r = _run([sys.executable, str(SCRIPTS / "test_inference.py")])
    combined = r.stdout + r.stderr
    assert r.returncode != 0, "running with no arguments at all reported success"
    assert "Traceback" not in combined or "NameError" not in combined, (
        f"crashed rather than refusing:\n{combined[-600:]}"
    )


# --------------------------------------------------------------------------
# the Node helpers
# --------------------------------------------------------------------------

@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
@pytest.mark.parametrize("name", NODE_TOOLS)
def test_the_node_tools_parse_and_refuse_without_arguments(name):
    """They read R2 credentials from .env. Without arguments they must explain
    themselves; a bare stack trace tells the operator nothing about what to pass."""
    env = {**os.environ, "R2_ACCOUNT_ID": "", "R2_ACCESS_KEY_ID": "", "R2_SECRET_ACCESS_KEY": ""}
    r = _run(["node", str(SCRIPTS / name)], env=env)
    combined = r.stdout + r.stderr
    assert r.returncode != 0, f"{name} with no arguments reported success"
    assert combined.strip(), f"{name} failed silently — nothing on stdout or stderr"


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
@pytest.mark.parametrize("name", NODE_TOOLS)
def test_the_node_tools_are_syntactically_valid(name):
    """They are never imported by any suite, so a syntax error would sit undetected
    until the day someone needs to stage a wheel."""
    r = _run(["node", "--check", str(SCRIPTS / name)])
    assert r.returncode == 0, f"{name} does not parse:\n{r.stderr[-500:]}"
