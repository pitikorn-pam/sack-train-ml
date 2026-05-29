"""train_for_run.py — main entrypoint called by the Colab notebook.

Reads a Supabase ``run_id``, pulls config, runs the pipeline:

    1. log_step started
    2. validate dataset
    3. train YOLO (streams metrics live)
    4. eval FP32
    5. upload best.pt to R2
    6. create versions row
    7. finalize_run (succeeded | failed)

ONNX export, HEF compile, INT8 eval and gate checks are intentionally
out of scope here — they require Hailo SDK and run on a separate
workstation as a downstream manual step.

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
from sack_train_ml.release import assemble_bundle, build_manifest
from sack_train_ml.supabase_client import RegistryClient
from sack_train_ml.training import train_yolo


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--run-id", required=True)
    p.add_argument("--dry-run", action="store_true")
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
        dataset_yaml = _materialize_dataset(config, client, run_id)
        stats = validate_dataset(dataset_yaml, config.classes)
        client.log_step(run_id, 2, "dataset", "ok",
                        f"dataset OK · train={stats.train_images} val={stats.val_images}")

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

        # 5. Upload .pt artifact
        # HEF / ONNX compilation is handled out-of-band on a Hailo-equipped
        # workstation — sack-train-ml ships only the PyTorch weights.
        client.log_step(run_id, 5, "upload", "started", "Uploading .pt to R2")
        semver = f"1.0.0-{run_id[:8]}"
        uploads: dict[str, ArtifactRecord] = {}
        u_pt = client.upload_artifact(best_pt, kind="pytorch", run_id=run_id, semver=semver,
                                      quantization={"precision": "fp32", "method": "none", "source": "best_weights"})
        uploads["pytorch"] = u_pt.to_record()
        client.log_step(run_id, 5, "upload", "ok", f"Uploaded {best_pt.name}")

        # 6. Build manifest + create version
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
            artifacts={"pytorch": best_pt},
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
        client.log_step(run_id, 7, "version", "ok",
                        f"Version {version_row['semver']} created ({version_row['id']})")

        # 8. Finalize
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


def _materialize_dataset(config: Any, client: RegistryClient, run_id: str) -> Path:
    """Materialize the YOLO dataset locally and return the path to data.yaml.

    Supports three forms:
      1. ``config.dataset`` is a local path (used in dev/tests)
      2. ``config.dataset`` is ``datasets/...`` only → just the YAML (paths must
         already exist on disk; rare)
      3. ``config.dataset_bundle`` is set → download the ZIP, extract it, and
         (if a separate ``config.dataset`` YAML exists) drop the YAML into the
         extracted root so its relative paths resolve.
    """
    from urllib.request import urlopen

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

    return Path(dataset_ref)


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
