"""Hailo HEF compile pipeline — orchestration side (torch kernel).

This module runs in the *training* environment (torch / ultralytics). It does
NOT import the Hailo Dataflow Compiler. DFC pins numpy/scipy/tensorflow
versions that conflict with torch, so the actual ONNX->HEF compile runs as a
*subprocess* inside a dedicated DFC virtualenv via ``scripts/compile_clientrunner.py``.

Responsibilities here:
  - ``ensure_dfc_venv``  — create the DFC venv and install the gated wheel.
  - ``build_calib_dir``  — sample calibration images out of the training dataset.
  - ``compile_onnx_to_hef`` — shell out to the compile script, write meta.yaml.

The compile recipe itself (parse -> optimize -> compile, the 4 DFC traps) lives
in ``scripts/compile_clientrunner.py`` and is proven end-to-end (HEF runs on a
real Pi5 + Hailo-8L at ~38 FPS).
"""

from __future__ import annotations

import glob
import json
import os
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .contracts import sha256_file

REPO_ROOT = Path(__file__).resolve().parents[2]
COMPILE_SCRIPT = REPO_ROOT / "scripts" / "compile_clientrunner.py"

# Pinned DFC venv deps (match notebooks/compile_run.ipynb cell 10).
# ``onnx`` is needed by compile_clientrunner.detect_head to read the graph and
# derive end-nodes before translate_onnx_model (family/task auto-detection).
_DFC_VENV_DEPS = ["numpy==1.23.3", "scipy==1.10.1", "pillow", "onnx"]


@dataclass
class HefArtifact:
    hef_path: Path
    hef_meta_path: Path
    quantization: dict[str, Any] = field(default_factory=dict)


# ----------------------------------------------------------------------------
# DFC venv bootstrap
# ----------------------------------------------------------------------------

def _venv_python(venv_dir: str | Path) -> Path:
    venv_dir = Path(venv_dir)
    py = venv_dir / "bin" / "python"
    return py if py.exists() else venv_dir / "Scripts" / "python.exe"


def _resolve_dfc_interpreter() -> str:
    """Pick the interpreter to build the DFC venv on.

    DFC pins ``numpy==1.23.3``, which has no wheel for Python 3.12+ and fails to
    build from sdist. Colab's bare ``python3`` is 3.12, so probe for a 3.10/3.11
    interpreter first and fall back to ``python3`` / ``sys.executable`` only if
    none is found. Returns the interpreter path/name to pass to ``virtualenv -p``.
    """
    import shutil

    for name in ("python3.10", "python3.11", "python3"):
        found = shutil.which(name)
        if found:
            return found
    return sys.executable


def _has_dfc(py: Path) -> bool:
    try:
        r = subprocess.run(
            [str(py), "-c", "import hailo_sdk_client"],
            capture_output=True, text=True, timeout=120,
        )
        return r.returncode == 0
    except Exception:
        return False


def ensure_dfc_venv(wheel_path: str | Path, venv_dir: str | Path = "/content/hailo_venv") -> Path:
    """Create the DFC virtualenv (if missing) and install the gated DFC wheel.

    Returns the path to the venv's python. Idempotent: if the venv already has
    ``hailo_sdk_client`` importable, it's reused as-is.

    ``wheel_path`` is the local path to ``hailo_dataflow_compiler*.whl`` — the
    caller is responsible for fetching it (e.g. from R2 via the registry) first.
    """
    venv_dir = Path(venv_dir)
    py = _venv_python(venv_dir)
    if py.exists() and _has_dfc(py):
        print(f"[dfc] reusing venv {venv_dir} (hailo_sdk_client present)")
        return py

    wheel_path = Path(wheel_path)
    if not wheel_path.exists():
        raise FileNotFoundError(f"DFC wheel not found: {wheel_path}")

    print(f"[dfc] creating venv {venv_dir}")
    # Colab's base env may not ship virtualenv — bootstrap it. (We use
    # virtualenv rather than stdlib venv to match the proven notebook recipe.)
    try:
        import virtualenv  # noqa: F401
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "virtualenv"], check=True)
    interp = _resolve_dfc_interpreter()
    ver = subprocess.run([interp, "-c", "import sys; print(sys.version_info[0], sys.version_info[1])"],
                         capture_output=True, text=True)
    try:
        major, minor = (int(x) for x in ver.stdout.split())
    except ValueError:
        major, minor = 0, 0
    print(f"[dfc] building venv on interpreter {interp} (python {major}.{minor})")
    if (major, minor) >= (3, 12):
        print(f"[dfc] WARNING: interpreter is python {major}.{minor}; DFC pins numpy==1.23.3 which "
              f"has no wheel for py3.12+ and may fail to build. Install python3.10/3.11 to avoid this.")
    subprocess.run([sys.executable, "-m", "virtualenv", "-p", interp, str(venv_dir)],
                   check=True)
    pip = venv_dir / "bin" / "pip"
    # setuptools is REQUIRED before _DFC_VENV_DEPS: numpy==1.23.3 has no wheel for
    # py3.12 and builds from sdist via setuptools.build_meta. Newer virtualenv/pip
    # seeds omit setuptools -> "Cannot import 'setuptools.build_meta'" build failure.
    subprocess.run([str(pip), "install", "--upgrade", "pip", "setuptools", "wheel"], check=True)
    subprocess.run([str(pip), "install", *_DFC_VENV_DEPS], check=True)
    subprocess.run([str(pip), "install", str(wheel_path)], check=True)

    py = _venv_python(venv_dir)
    if not _has_dfc(py):
        raise RuntimeError(f"DFC wheel installed but hailo_sdk_client not importable in {venv_dir}")
    print(f"[dfc] venv ready: {py}")
    return py


# ----------------------------------------------------------------------------
# Calibration set — sampled from the training dataset
# ----------------------------------------------------------------------------

def build_calib_dir(dataset_yaml: str | Path, out_dir: str | Path, n: int = 512) -> Path:
    """Materialize a flat calibration image dir by sampling the dataset.

    Reads ``data.yaml``, resolves the ``val`` split (falls back to ``train``),
    and symlinks up to ``n`` images into ``out_dir`` (flat, what the compile
    script globs). Symlink first; copy on failure (e.g. cross-device).

    Reusing the training images is the proof-grade calib path. Production quant
    should override with real edge frames (>=1024) — see the unified-flow memo.
    """
    import shutil

    try:
        import yaml  # type: ignore
    except ImportError as e:  # pragma: no cover
        raise RuntimeError("pyyaml required to read data.yaml for calib") from e

    dataset_yaml = Path(dataset_yaml)
    cfg = yaml.safe_load(dataset_yaml.read_text()) or {}
    base = Path(cfg.get("path") or dataset_yaml.parent)

    imgs: list[str] = []
    for split in ("val", "train"):
        rel = cfg.get(split)
        if not rel:
            continue
        img_dir = base / rel
        if not img_dir.is_dir():
            # data.yaml may point at a labels-style path; try as-is and parent
            img_dir = (base / rel).resolve()
        found = []
        for ext in ("*.jpg", "*.jpeg", "*.png"):
            found += glob.glob(str(img_dir / ext))
            found += glob.glob(str(img_dir / "**" / ext), recursive=True)
        imgs = sorted(set(found))
        if imgs:
            print(f"[calib] using split='{split}' dir={img_dir} ({len(imgs)} imgs)")
            break
    if not imgs:
        raise FileNotFoundError(f"no calib images found under {base} (val/train)")

    out_dir = Path(out_dir)
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    picked = imgs[:n]
    for i, src in enumerate(picked):
        dst = out_dir / f"calib_{i:05d}{Path(src).suffix.lower()}"
        try:
            os.symlink(os.path.abspath(src), dst)
        except OSError:
            shutil.copy2(src, dst)
    print(f"[calib] {len(picked)} imgs -> {out_dir} (requested {n})")
    return out_dir


# ----------------------------------------------------------------------------
# Compile — shells out to the DFC venv
# ----------------------------------------------------------------------------

def compile_onnx_to_hef(
    onnx_path: str | Path,
    calib_dir: str | Path,
    out_dir: str | Path,
    model_name: str,
    venv_python: str | Path,
    *,
    target: str = "hailo8l",
    input_size: int = 640,
    classes: int = 2,
    calib_n: int = 512,
    opt_level: int = 0,
    scores_th: float = 0.20,
    iou_th: float = 0.70,
    max_per_class: int = 50,
    reg_len: int = 16,
    source_onnx_sha: str | None = None,
    git_sha: str | None = None,
    extra_meta: dict[str, Any] | None = None,
) -> HefArtifact:
    """Run ONNX -> HEF via the DFC venv subprocess and write meta.yaml.

    ``venv_python`` must point at a python with ``hailo_sdk_client`` installed
    (see ``ensure_dfc_venv``). Raises ``RuntimeError`` if the compile fails or
    the HEF is not produced.
    """
    onnx_path = Path(onnx_path)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    hef_path = out / f"{model_name}.hef"

    cmd = [
        str(venv_python), str(COMPILE_SCRIPT),
        "--onnx", str(onnx_path),
        "--calib", str(calib_dir),
        "--out", str(hef_path),
        "--work", str(out),
        "--hw", target,
        "--net", model_name,
        "--classes", str(classes),
        "--size", str(input_size),
        "--calib-n", str(calib_n),
        "--opt-level", str(opt_level),
        "--scores-th", str(scores_th),
        "--iou-th", str(iou_th),
        "--max-per-class", str(max_per_class),
        "--reg-len", str(reg_len),
    ]
    print("[compile]", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    sys.stdout.write(result.stdout)
    sys.stderr.write(result.stderr)
    if result.returncode != 0:
        raise RuntimeError(f"DFC compile failed (exit {result.returncode}); see log above")
    if not hef_path.exists():
        raise FileNotFoundError(f"compile finished but {hef_path} not present")

    # The compile script prints a ``DETECT {json}`` line with the auto-detected
    # head family + NMS mode; surface those in the meta so the edge knows whether
    # the HEF carries on-chip NMS (yolov11 detect) or needs off-chip decode (raw).
    detected: dict[str, Any] = {}
    for line in result.stdout.splitlines():
        if line.startswith("DETECT "):
            try:
                detected = json.loads(line[len("DETECT "):])
            except json.JSONDecodeError:
                pass

    sha, size = sha256_file(hef_path)
    meta = {
        "model_name": model_name,
        "target": target,
        "input_shape": [input_size, input_size, 3],
        "classes": classes,
        "source_onnx": onnx_path.name,
        "source_onnx_sha256": source_onnx_sha,
        "git_sha": git_sha,
        "hef_size_bytes": size,
        "hef_sha256": sha,
        "compiler": "dfc_clientrunner",
        "model_family": detected.get("family"),
        "optimization_level": opt_level,
        "calib_images": calib_n,
        "nms": {
            "mode": detected.get("nms"),
            "scores_th": scores_th, "iou_th": iou_th,
            "max_per_class": max_per_class, "regression_length": reg_len,
        },
    }
    if extra_meta:
        meta.update(extra_meta)
    meta_path = out / f"{model_name}.hef.meta.yaml"
    meta_path.write_text(_dump_simple_yaml(meta))
    print("[compile] meta ->", meta_path)

    return HefArtifact(
        hef_path=hef_path,
        hef_meta_path=meta_path,
        quantization={
            "precision": "int8",
            "method": "dfc_clientrunner",
            "optimization_level": opt_level,
            "calib_images": calib_n,
            "target": target,
        },
    )


def _dump_simple_yaml(d: dict[str, Any], indent: int = 0) -> str:
    lines = []
    pad = "  " * indent
    for k, v in d.items():
        if isinstance(v, dict):
            lines.append(f"{pad}{k}:")
            lines.append(_dump_simple_yaml(v, indent + 1).rstrip("\n"))
        elif isinstance(v, list):
            lines.append(f"{pad}{k}: " + json.dumps(v))
        else:
            lines.append(f"{pad}{k}: {v}")
    return "\n".join(lines) + "\n"
