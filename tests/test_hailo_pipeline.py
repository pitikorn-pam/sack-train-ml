"""The calibration set is what INT8 quantization measures activations against.

Getting it wrong is not a degradation, it is a refusal: synthetic frames made DFC
decline to quantize outright with `NegativeSlopeExponentNonFixable`, and the wrong
images produce a HEF that reports success and counts nothing on the device. This module
had no test.

Only the parts that need neither the DFC nor a GPU are exercised here — the calibration
sampler and the meta writer. The compile itself shells out to a virtualenv that exists
only on a machine with the gated wheel.

    pytest tests/test_hailo_pipeline.py
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest

from sack_train_ml.hailo_pipeline import _dump_simple_yaml, build_calib_dir


def _dataset(root: Path, *, val_images=0, train_images=0, path_key=None) -> Path:
    for split, n in (("val", val_images), ("train", train_images)):
        d = root / "images" / split
        d.mkdir(parents=True, exist_ok=True)
        for i in range(n):
            (d / f"{i:04d}.jpg").write_bytes(b"\xff\xd8\xff")
    lines = []
    if path_key is not None:
        lines.append(f"path: {path_key}")
    lines += ["val: images/val", "train: images/train", "names:", "  0: person", "  1: sack"]
    y = root / "data.yaml"
    y.write_text("\n".join(lines) + "\n")
    return y


def test_it_prefers_the_val_split(tmp_path):
    """Calibrating on train is measuring the model against what it memorised."""
    y = _dataset(tmp_path, val_images=5, train_images=9)
    out = build_calib_dir(y, tmp_path / "calib", n=100)
    assert len(list(out.iterdir())) == 5


def test_it_falls_back_to_train_when_there_is_no_val(tmp_path):
    y = _dataset(tmp_path, val_images=0, train_images=7)
    out = build_calib_dir(y, tmp_path / "calib", n=100)
    assert len(list(out.iterdir())) == 7


def test_it_honours_the_requested_count(tmp_path):
    y = _dataset(tmp_path, val_images=20)
    assert len(list(build_calib_dir(y, tmp_path / "calib", n=6).iterdir())) == 6


def test_asking_for_more_than_exist_yields_what_exists(tmp_path):
    """Silently returning fewer is correct — but the caller must be able to see it,
    which is why the count is on disk rather than assumed from `n`. optimization_level 2
    needs 1024 images and a set of 40 would otherwise look like a set of 1024."""
    y = _dataset(tmp_path, val_images=4)
    assert len(list(build_calib_dir(y, tmp_path / "calib", n=1024).iterdir())) == 4


def test_no_images_anywhere_raises_rather_than_producing_an_empty_set(tmp_path):
    """An empty calibration directory would let the compile proceed and quantize
    against nothing."""
    y = _dataset(tmp_path, val_images=0, train_images=0)
    with pytest.raises(FileNotFoundError, match="no calib images"):
        build_calib_dir(y, tmp_path / "calib", n=10)


def test_the_output_is_flat_and_predictably_named(tmp_path):
    """The compile script globs a flat directory; a nested tree would silently match
    nothing."""
    y = _dataset(tmp_path, val_images=3)
    out = build_calib_dir(y, tmp_path / "calib", n=3)
    names = sorted(p.name for p in out.iterdir())
    assert names == ["calib_00000.jpg", "calib_00001.jpg", "calib_00002.jpg"]
    assert all(p.is_file() or p.is_symlink() for p in out.iterdir())


def test_a_previous_calibration_set_is_replaced_not_merged(tmp_path):
    """Two compiles are only comparable if they can be shown to have used the same
    images. Leftovers from a previous run would make that false without any sign."""
    y = _dataset(tmp_path, val_images=2)
    out = tmp_path / "calib"
    out.mkdir()
    (out / "stale_from_last_run.jpg").write_bytes(b"x")
    build_calib_dir(y, out, n=10)
    assert not (out / "stale_from_last_run.jpg").exists()
    assert len(list(out.iterdir())) == 2


def test_the_links_point_at_the_real_images(tmp_path):
    y = _dataset(tmp_path, val_images=2)
    out = build_calib_dir(y, tmp_path / "calib", n=2)
    for p in out.iterdir():
        assert Path(os.path.realpath(p)).read_bytes() == b"\xff\xd8\xff"


# --------------------------------------------------------------------------
# the meta writer — what records how a HEF was built
# --------------------------------------------------------------------------

def test_meta_yaml_round_trips_through_pyyaml():
    """The .hef.meta.yaml is read back by the edge repo, so a hand-rolled dumper that
    emits something pyyaml cannot parse would break the cross-repo contract."""
    yaml = pytest.importorskip("yaml")
    text = _dump_simple_yaml({
        "model": "yolo11s",
        "input_size": [640, 640, 3],
        "quantization": {"optimization_level": 0, "calib_images": 512, "target": "hailo8l"},
    })
    parsed = yaml.safe_load(text)
    assert parsed["input_size"] == [640, 640, 3]
    assert parsed["quantization"]["calib_images"] == 512
    assert parsed["quantization"]["target"] == "hailo8l"


def test_meta_yaml_nests_without_losing_a_level():
    yaml = pytest.importorskip("yaml")
    parsed = yaml.safe_load(_dump_simple_yaml({"a": {"b": {"c": 1}}}))
    assert parsed == {"a": {"b": {"c": 1}}}


# ---------------------------------------------------------------------------
# DFC interpreter selection
#
# The DFC venv is the step that silently ate a Colab session: the runtime moved to
# python 3.13, the venv was built on it anyway, every install inside it failed, and
# the first visible error was a scipy build failure that never named the
# interpreter. These pin the guard, because the failure it prevents is expensive
# and invisible — nothing downstream of a bad venv reports a wrong python.
# ---------------------------------------------------------------------------

def test_dfc_python_is_the_highest_version_every_pin_has_a_wheel_for():
    """3.11 is not a preference. numpy==1.23.3 and scipy==1.10.1 publish cp38-cp311,
    and DFC 3.33.1's own scipy==1.12.0 pin stops at cp312 — so 3.11 is the ceiling,
    and raising this constant without re-checking PyPI would reintroduce the failure."""
    from sack_train_ml.hailo_pipeline import DFC_PYTHON, _DFC_VENV_DEPS

    assert DFC_PYTHON == "3.11"
    assert "numpy==1.23.3" in _DFC_VENV_DEPS
    assert "scipy==1.10.1" in _DFC_VENV_DEPS


def test_ensure_dfc_venv_refuses_an_interpreter_too_new_to_install_on(tmp_path, monkeypatch):
    """A doomed install must fail on its first line, not after minutes of downloads."""
    from sack_train_ml import hailo_pipeline as hp

    wheel = tmp_path / "hailo_dataflow_compiler-3.33.1-py3-none-linux_x86_64.whl"
    wheel.write_bytes(b"not a real wheel")

    monkeypatch.setattr(hp, "_resolve_dfc_interpreter", lambda: "/usr/bin/python3.13")

    created = []

    def fake_run(cmd, *a, **kw):
        # Match venv *creation* — `-m virtualenv -p <interp>` — and nothing else. An
        # earlier version of this test asserted on the bare string "virtualenv" and
        # tripped over the `pip install -q virtualenv` bootstrap, which runs
        # legitimately before the interpreter is even chosen.
        if "-m" in cmd and "virtualenv" in cmd and "-p" in cmd:
            created.append(cmd)
        import subprocess as sp
        return sp.CompletedProcess(cmd, 0, stdout="3 13\n", stderr="")

    monkeypatch.setattr(hp.subprocess, "run", fake_run)

    with pytest.raises(RuntimeError, match=r"needs python 3\.11 or 3\.10, got 3\.13"):
        hp.ensure_dfc_venv(wheel, venv_dir=tmp_path / "venv")

    assert not created, f"built a venv on a refused interpreter: {created}"


def test_resolve_dfc_interpreter_prefers_an_installed_311_over_uv(monkeypatch):
    from sack_train_ml import hailo_pipeline as hp
    import shutil

    monkeypatch.setattr(shutil, "which", lambda n: "/usr/bin/python3.11" if n == "python3.11" else None)
    monkeypatch.setattr(hp, "_uv_fetch_python", lambda *a, **k: pytest.fail("uv called despite a local 3.11"))
    assert hp._resolve_dfc_interpreter() == "/usr/bin/python3.11"


def test_resolve_dfc_interpreter_falls_back_to_uv_then_warns(monkeypatch, capsys):
    """On Colab there is no python3.11 to find, so uv is the path that has to work.
    When even that fails the fallback must say so out loud — the silent version of
    this line is what made the original failure unreadable."""
    from sack_train_ml import hailo_pipeline as hp
    import shutil

    monkeypatch.setattr(shutil, "which", lambda n: "/usr/bin/python3" if n == "python3" else None)

    monkeypatch.setattr(hp, "_uv_fetch_python", lambda *a, **k: "/opt/uv/python3.11")
    assert hp._resolve_dfc_interpreter() == "/opt/uv/python3.11"
    assert "uv-provided" in capsys.readouterr().out

    monkeypatch.setattr(hp, "_uv_fetch_python", lambda *a, **k: None)
    assert hp._resolve_dfc_interpreter() == "/usr/bin/python3"
    assert "WARNING" in capsys.readouterr().out
