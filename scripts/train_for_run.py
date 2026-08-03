"""train_for_run.py — main entrypoint called by the Colab notebook.

Reads a Supabase ``run_id``, pulls config, runs the pipeline:

    1. log_step started
    2. validate dataset
    3. train YOLO (streams metrics live)
    4. eval FP32
    5. export ONNX
    6. upload best.pt + best.onnx to R2
    6b. (optional) compile INT8 .hef + upload — when ``compile_options.compile_hef``
        is set. Runs in the same Colab session via a dedicated DFC virtualenv
        subprocess (see sack_train_ml.hailo_pipeline). Failure-safe: if the
        compile fails the .pt/.onnx artifacts are still published.
    7. create versions row (with whatever artifacts succeeded)
    8. finalize_run (succeeded | failed)

INT8 eval and gate checks against event-GT remain a downstream step — the
in-flow compile produces a basic-quant (opt_level 0) HEF by default, which
proves the pipeline/version. Production quant wants calib>=1024 + opt_level 2.

Usage:
    python scripts/train_for_run.py --run-id <uuid>

Env required:
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# sys.path so the script can be run from anywhere
REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from sack_train_ml.contracts import ArtifactRecord, ReleaseManifest, sha256_file
from sack_train_ml.dataset import validate_dataset
from sack_train_ml.evaluation import normalize_metrics
from sack_train_ml.export_onnx import export_onnx
from sack_train_ml.release import assemble_bundle, build_manifest
from sack_train_ml.supabase_client import RegistryClient
from sack_train_ml.training import train_yolo


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--run-id", required=True)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--skip-hef", action="store_true",
                   help="force-skip the in-flow HEF compile even if compile_options.compile_hef is set")
    p.add_argument("--dataset-dir", default=os.environ.get("BSCP_DATASET_DIR") or None,
                   help="use an already-present dataset folder (must contain data.yaml) "
                        "instead of downloading the one named in the run config. "
                        "Defaults to $BSCP_DATASET_DIR.")
    args = p.parse_args(argv)

    run_id = args.run_id
    client = RegistryClient()
    git_sha = _current_git_sha(REPO_ROOT)

    # 1. Mark run as running + log start
    config, run_row = client.load_run_config(run_id)
    model_line_id = run_row["model_line_id"]
    client.mark_running(run_id)
    client.log_step(run_id, 1, "init", "info",
                    f"train_for_run starting · git={git_sha or 'unknown'} dry_run={args.dry_run}")

    try:
        # 2. Materialize + validate dataset
        dataset_yaml = _materialize_dataset(config, client, run_id, args.dataset_dir)
        stats = validate_dataset(dataset_yaml, config.classes)
        client.log_step(run_id, 2, "dataset", "ok",
                        f"dataset OK · train={stats.train_images} val={stats.val_images} "
                        f"yaml={dataset_yaml}")

        if args.dry_run:
            client.log_step(run_id, 1, "init", "info", "dry-run; stopping before train")
            client.finalize_run(run_id, status="succeeded")
            return 0

        # 3. Train
        run_dir = REPO_ROOT / "runs" / run_id
        model = train_yolo(
            config=config,
            client=client,
            run_id=run_id,
            dataset_yaml_path=dataset_yaml,
            project_dir=str(run_dir.parent),
            run_name=run_id,
        )
        save_dir = Path(getattr(model, "trainer", None).save_dir) if hasattr(model, "trainer") else run_dir
        best_pt = _find_best_pt(save_dir)

        # 4. Eval FP32
        fp32_eval = _eval_fp32(model)
        client.log_step(run_id, 4, "eval-fp32", "ok",
                        f"FP32 mAP50={fp32_eval.get('map50'):.4f}" if "map50" in fp32_eval else "FP32 eval done")

        # 5. Export ONNX
        client.log_step(run_id, 5, "export", "started", "ONNX export starting")
        onnx_path = export_onnx(model, save_dir, imgsz=_imgsz(config))
        client.log_step(run_id, 5, "export", "ok", f"ONNX → {onnx_path.name}")

        # 6. Upload .pt + .onnx artifacts
        # HEF compile (ONNX → INT8 .hef) is intentionally out-of-band — it
        # needs the Hailo Dataflow Compiler on an x86_64 Linux workstation.
        client.log_step(run_id, 6, "upload", "started", "Uploading artifacts to R2")
        semver = f"1.0.0-{run_id[:8]}"
        uploads: dict[str, ArtifactRecord] = {}
        u_pt = client.upload_artifact(best_pt, kind="pytorch", run_id=run_id, semver=semver,
                                      quantization={"precision": "fp32", "method": "none", "source": "best_weights"})
        uploads["pytorch"] = u_pt.to_record()
        u_onnx = client.upload_artifact(onnx_path, kind="onnx", run_id=run_id, semver=semver)
        uploads["onnx"] = u_onnx.to_record()
        client.log_step(run_id, 6, "upload", "ok",
                        f"Uploaded {best_pt.name} + {onnx_path.name}")

        # 6b. Optional: compile INT8 .hef in-session (gated by compile_options).
        # Failure-safe — a compile failure logs a warning but the .pt/.onnx
        # artifacts above are still published into the version below.
        if args.skip_hef:
            client.log_step(run_id, 7, "compile", "info", "HEF compile skipped (--skip-hef)")
        else:
            _maybe_compile_hef(
                config=config, client=client, run_id=run_id, semver=semver,
                onnx_path=onnx_path, onnx_sha=u_onnx.content_hash,
                dataset_yaml=dataset_yaml, save_dir=save_dir, git_sha=git_sha,
                uploads=uploads,
            )

        # 7. Build manifest + create version
        manifest = build_manifest(
            version=semver,
            model_name=run_row.get("provider_job_id") or "yolo11s-sack",
            run_id=run_id,
            git_sha=git_sha,
            uploaded=uploads,
            metrics_summary={
                "fp32": normalize_metrics(fp32_eval) if fp32_eval else {},
            },
            class_names=config.classes,
            input_size=config.input_size,
            task=config.task,
            output_kind=config.output_kind,
        )
        # Save bundle locally for QA
        bundle_dir = save_dir / "release"
        assemble_bundle(
            bundle_dir=bundle_dir,
            artifacts={"pytorch": best_pt, "onnx": onnx_path},
            eval_fp32=fp32_eval or None,
            eval_int8=None,
            manifest=manifest,
        )

        metadata = {
            "class_names": config.classes,
            "input_size": config.input_size,
            "task": config.task,
            "output_kind": config.output_kind,
            "hyperparameters": config.hyperparameters,
            "export_options": config.export_options,
            "metrics_summary": manifest.metrics_summary,
            "git_sha": git_sha,
        }
        version_row = client.create_version(
            run_id=run_id,
            model_line_id=model_line_id,
            semver=semver,
            artifacts=uploads,
            metadata=metadata,
            size_bytes=sum(a.size_bytes for a in uploads.values()),
            content_hash=None,
        )
        client.log_step(run_id, 8, "version", "ok",
                        f"Version {version_row['semver']} created ({version_row['id']})")

        # 9. Finalize
        client.finalize_run(run_id, status="succeeded")
        return 0

    except Exception as exc:  # noqa: BLE001
        import traceback
        err = f"{type(exc).__name__}: {exc}"
        try:
            client.log_step(run_id, 0, "fatal", "error", err)
        except Exception:
            pass
        try:
            client.finalize_run(run_id, status="failed", error=err)
        except Exception:
            pass
        traceback.print_exc()
        return 1


# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------

def _current_git_sha(root: Path) -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=root, capture_output=True, text=True, check=True,
        )
        return out.stdout.strip()
    except Exception:
        return None


def _download_url(url: str, dest: Path) -> None:
    from urllib.request import urlopen
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(url, timeout=300) as r, open(dest, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)


def _maybe_compile_hef(
    *,
    config: Any,
    client: RegistryClient,
    run_id: str,
    semver: str,
    onnx_path: Path,
    onnx_sha: str,
    dataset_yaml: Path,
    save_dir: Path,
    git_sha: str | None,
    uploads: dict[str, ArtifactRecord],
) -> None:
    """Optional in-flow HEF compile (step 6b). No-op unless ``compile_hef`` set.

    Runs the DFC ClientRunner recipe inside a dedicated venv subprocess. On
    success appends ``hef`` + ``hef_meta`` to ``uploads`` so they land in the
    same version row. On any failure, logs a warning and returns — the .pt/.onnx
    artifacts already in ``uploads`` are still published.
    """
    copts = getattr(config, "compile_options", {}) or {}
    if not copts.get("compile_hef"):
        return

    try:
        from sack_train_ml.hailo_pipeline import (
            build_calib_dir,
            compile_onnx_to_hef,
            ensure_dfc_venv,
        )

        client.log_step(run_id, 7, "compile", "started", "HEF compile (DFC ClientRunner) starting")

        wheel_key = copts.get("wheel_key")
        if not wheel_key:
            raise ValueError("compile_options.wheel_key (R2 DFC wheel) is required when compile_hef=true")
        wheel_local = REPO_ROOT / "tools" / Path(wheel_key).name
        if not wheel_local.exists():
            _download_url(client.download_tool(wheel_key), wheel_local)
            client.log_step(run_id, 7, "compile", "info", f"DFC wheel pulled · {wheel_local.name}")
        venv_py = ensure_dfc_venv(wheel_local, copts.get("venv_dir", "/content/hailo_venv"))

        calib_n = int(copts.get("calib_n", 512))
        calib_dir = build_calib_dir(dataset_yaml, REPO_ROOT / "data" / "calib" / run_id, n=calib_n)

        size = _imgsz(config)
        net_name = copts.get("net_name", "yolov11s_sack")
        art = compile_onnx_to_hef(
            onnx_path=onnx_path,
            calib_dir=calib_dir,
            out_dir=save_dir / "hef",
            model_name=net_name,
            venv_python=venv_py,
            target=(config.export_options or {}).get("hailo_target", "hailo8l"),
            input_size=size,
            classes=len(config.classes),
            calib_n=calib_n,
            opt_level=int(copts.get("opt_level", 0)),
            scores_th=float(copts.get("scores_th", 0.20)),
            iou_th=float(copts.get("iou_th", 0.70)),
            max_per_class=int(copts.get("max_per_class", 50)),
            reg_len=int(copts.get("reg_len", 16)),
            source_onnx_sha=onnx_sha,
            git_sha=git_sha,
            extra_meta={"run_id": run_id, "semver": semver, "class_names": config.classes},
        )

        u_hef = client.upload_artifact(art.hef_path, kind="hef", run_id=run_id, semver=semver,
                                       quantization=art.quantization)
        uploads["hef"] = u_hef.to_record()
        u_meta = client.upload_artifact(art.hef_meta_path, kind="hef_meta", run_id=run_id, semver=semver)
        uploads["hef_meta"] = u_meta.to_record()
        client.log_step(run_id, 7, "compile", "ok",
                        f"HEF compiled + uploaded · {art.hef_path.name} (opt_level={copts.get('opt_level', 0)})")
    except Exception as exc:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        try:
            client.log_step(run_id, 7, "compile", "warn",
                            f"HEF compile skipped/failed: {type(exc).__name__}: {exc} — .pt/.onnx still published")
        except Exception:
            pass


def _materialize_dataset(
    config: Any,
    client: RegistryClient,
    run_id: str,
    dataset_dir: str | None = None,
) -> Path:
    """Materialize the YOLO dataset locally and return the path to data.yaml.

    Supports four forms:
      0. ``dataset_dir`` (``--dataset-dir`` / ``BSCP_DATASET_DIR``) points at an
         already-present dataset folder → use the ``data.yaml`` inside it and
         skip every download. Overrides the run config.
      1. ``config.dataset`` is a local path (used in dev/tests)
      2. ``config.dataset`` is ``datasets/...`` only → just the YAML (paths must
         already exist on disk; rare)
      3. ``config.dataset_bundle`` is set → download the ZIP, extract it, and
         (if a separate ``config.dataset`` YAML exists) drop the YAML into the
         extracted root so its relative paths resolve.
    """
    from urllib.request import urlopen

    if dataset_dir:
        root = Path(dataset_dir).expanduser().resolve()
        if not root.is_dir():
            raise FileNotFoundError(f"--dataset-dir does not exist: {root}")
        local_yaml = root / "data.yaml"
        if not local_yaml.exists():
            raise FileNotFoundError(f"no data.yaml inside --dataset-dir {root}")
        client.log_step(run_id, 2, "dataset", "info",
                        f"using local dataset dir (config.dataset ignored) → {root}")
        _normalize_dataset_yaml(local_yaml, root, client, run_id)
        return local_yaml

    def _download(ref: str, dest: Path) -> None:
        url = client.download_dataset(ref)
        dest.parent.mkdir(parents=True, exist_ok=True)
        with urlopen(url, timeout=120) as r, open(dest, "wb") as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)

    dataset_ref = config.dataset
    bundle_ref = getattr(config, "dataset_bundle", None)

    if bundle_ref:
        zip_path = REPO_ROOT / "data" / "remote" / Path(bundle_ref).name
        _download(bundle_ref, zip_path)
        extract_root = REPO_ROOT / "data" / "extracted" / run_id
        if extract_root.exists():
            import shutil
            shutil.rmtree(extract_root)
        extract_root.mkdir(parents=True, exist_ok=True)

        import zipfile
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(extract_root)
        client.log_step(run_id, 2, "dataset", "info",
                        f"extracted {bundle_ref} → {extract_root}")

        # If the zip has a single top-level directory, descend into it so
        # the YAML's relative paths line up.
        entries = [p for p in extract_root.iterdir() if not p.name.startswith(".")]
        if len(entries) == 1 and entries[0].is_dir():
            extract_root = entries[0]

        # Locate or place data.yaml inside the extracted root.
        if dataset_ref and dataset_ref.startswith("datasets/"):
            local_yaml = extract_root / "data.yaml"
            _download(dataset_ref, local_yaml)
            client.log_step(run_id, 2, "dataset", "info",
                            f"pulled {dataset_ref} → {local_yaml}")
            _normalize_dataset_yaml(local_yaml, extract_root, client, run_id)
            return local_yaml

        local_yaml: Path | None = None
        for candidate in ("data.yaml", "dataset.yaml", "yolo.yaml"):
            p = extract_root / candidate
            if p.exists():
                local_yaml = p
                break
        if local_yaml is None:
            raise FileNotFoundError(
                f"no data.yaml inside bundle {bundle_ref} and no dataset YAML configured"
            )
        _normalize_dataset_yaml(local_yaml, extract_root, client, run_id)
        return local_yaml

    if dataset_ref and dataset_ref.startswith("datasets/"):
        local = REPO_ROOT / "data" / "remote" / Path(dataset_ref).name
        _download(dataset_ref, local)
        client.log_step(run_id, 2, "dataset", "info", f"pulled {dataset_ref} → {local}")
        return local

    local_yaml = Path(dataset_ref).expanduser().resolve()
    if local_yaml.is_dir():
        local_yaml = local_yaml / "data.yaml"
    if local_yaml.exists():
        _normalize_dataset_yaml(local_yaml, local_yaml.parent, client, run_id)
    return local_yaml


def _normalize_dataset_yaml(
    yaml_path: Path,
    extract_root: Path,
    client: RegistryClient,
    run_id: str,
) -> None:
    """Roboflow YAMLs ship with ``train: ../train/images`` which resolves
    outside the dataset root. Rewrite to absolute ``path`` + strip ``../``
    prefixes so ultralytics sees the right folders.
    """
    try:
        import yaml  # type: ignore
    except ImportError:
        client.log_step(run_id, 2, "dataset", "warn",
                        "pyyaml not available, skipping yaml normalization")
        return

    try:
        cfg = yaml.safe_load(yaml_path.read_text()) or {}
    except Exception as e:
        client.log_step(run_id, 2, "dataset", "warn",
                        f"could not parse {yaml_path.name}: {e}")
        return

    changed = False
    for key in ("train", "val", "test"):
        v = cfg.get(key)
        if isinstance(v, str) and v.startswith("../"):
            cfg[key] = v.lstrip("./")
            changed = True

    abs_root = str(extract_root.resolve())
    if cfg.get("path") != abs_root:
        cfg["path"] = abs_root
        changed = True

    if changed:
        yaml_path.write_text(yaml.safe_dump(cfg, sort_keys=False))
        client.log_step(run_id, 2, "dataset", "info",
                        f"normalized {yaml_path.name} · path={abs_root}")


def _imgsz(config) -> int:
    s = getattr(config, "input_size", None)
    if isinstance(s, list) and len(s) >= 1:
        return int(s[0])
    return 640


def _find_best_pt(save_dir: Path) -> Path:
    candidates = [
        save_dir / "weights" / "best.pt",
        save_dir / "best.pt",
    ]
    for c in candidates:
        if c.exists():
            return c
    raise FileNotFoundError(f"best.pt not found under {save_dir}")


def _eval_fp32(model: Any) -> dict[str, Any]:
    try:
        res = model.val()
        # YOLO val returns a metrics object; coerce to dict
        out: dict[str, Any] = {}
        for k in dir(res):
            if k.startswith("_"):
                continue
            v = getattr(res, k, None)
            if isinstance(v, (int, float)):
                out[k] = v
        return out
    except Exception:
        return {}


if __name__ == "__main__":
    sys.exit(main())
