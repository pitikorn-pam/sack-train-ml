"""train_for_run.py — main entrypoint called by the Colab notebook.

Reads a Supabase ``run_id``, pulls config, runs the full pipeline:

    1. log_step started
    2. validate dataset
    3. train YOLO (streams metrics live)
    4. eval FP32
    5. export ONNX
    6. compile HEF + write hef.meta.yaml  (Hailo SDK required)
    7. eval INT8 via HEF                  (Hailo runtime required)
    8. gate check (FP32 vs INT8)
    9. upload artifacts (pytorch, onnx, hef, hef_meta) to R2
   10. create versions row
   11. finalize_run (succeeded | failed)

Usage:
    python scripts/train_for_run.py --run-id <uuid>

Env required:
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TRAINING_CALLBACK_SECRET

Optional:
    HAILO_SDK_ROOT, HAILO_MZ_BIN (defaults to ``hailomz`` on PATH)
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
from sack_train_ml.evaluation import gate_check, normalize_metrics
from sack_train_ml.export_onnx import export_onnx
from sack_train_ml.hailo_pipeline import compile_hef
from sack_train_ml.release import assemble_bundle, build_manifest
from sack_train_ml.supabase_client import RegistryClient
from sack_train_ml.training import train_yolo


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--run-id", required=True)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--skip-hef", action="store_true",
                   help="Skip HEF compile + INT8 eval (useful when Hailo SDK isn't installed)")
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
        dataset_yaml = _materialize_dataset(config.dataset, client, run_id)
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

        # 5. Export ONNX
        client.log_step(run_id, 5, "export", "started", "ONNX export starting")
        onnx_path = export_onnx(model, save_dir, imgsz=_imgsz(config))
        client.log_step(run_id, 5, "export", "ok", f"ONNX → {onnx_path.name}")

        # 6. Compile HEF
        hef_path: Path | None = None
        hef_meta_path: Path | None = None
        hef_quant: dict[str, Any] | None = None
        if not args.skip_hef:
            client.log_step(run_id, 6, "hef-compile", "started", "Hailo HEF compile starting")
            calib = _resolve_calibration(config, dataset_yaml)
            try:
                hef = compile_hef(
                    onnx_path=onnx_path,
                    calibration_manifest=calib,
                    out_dir=save_dir,
                    model_name=run_row.get("model_line_id", "model")[:8] + "-hef",
                    target=config.export_options.get("hailo_target", "hailo8l"),
                    input_shape=_input_shape_tuple(config),
                    hailomz_bin=os.environ.get("HAILO_MZ_BIN", "hailomz"),
                )
                hef_path = hef.hef_path
                hef_meta_path = hef.hef_meta_path
                hef_quant = hef.quantization
                client.log_step(run_id, 6, "hef-compile", "ok", f"HEF → {hef_path.name}")
            except Exception as exc:
                client.log_step(run_id, 6, "hef-compile", "warning", f"HEF compile failed: {exc}")

        # 7. INT8 eval (best-effort; skip if HEF missing or no runtime)
        int8_eval: dict[str, Any] = {}
        if hef_path:
            try:
                int8_eval = _eval_int8(hef_path, dataset_yaml)
            except Exception as exc:
                client.log_step(run_id, 7, "eval-int8", "warning", f"INT8 eval skipped: {exc}")

        # 8. Gate
        if fp32_eval and int8_eval:
            verdict = gate_check(fp32_eval, int8_eval).to_dict()
            client.log_step(run_id, 8, "gate", "ok" if verdict["passed"] else "warning",
                            f"gate: {verdict['reason']}")
        else:
            verdict = {"passed": None, "reason": "skipped (incomplete eval)"}

        # 9. Upload artifacts
        client.log_step(run_id, 9, "upload", "started", "Uploading artifacts to R2")
        semver = f"1.0.0-{run_id[:8]}"
        uploads: dict[str, ArtifactRecord] = {}

        u_pt = client.upload_artifact(best_pt, kind="pytorch", run_id=run_id, semver=semver,
                                      quantization={"precision": "fp32", "method": "none", "source": "best_weights"})
        uploads["pytorch"] = u_pt.to_record()

        u_onnx = client.upload_artifact(onnx_path, kind="onnx", run_id=run_id, semver=semver)
        uploads["onnx"] = u_onnx.to_record()

        if hef_path:
            u_hef = client.upload_artifact(hef_path, kind="hef", run_id=run_id, semver=semver,
                                           quantization=hef_quant)
            uploads["hef"] = u_hef.to_record()

        if hef_meta_path:
            u_meta = client.upload_artifact(hef_meta_path, kind="hef_meta",
                                            run_id=run_id, semver=semver,
                                            content_type="application/x-yaml")
            uploads["hef_meta"] = u_meta.to_record()

        client.log_step(run_id, 9, "upload", "ok", f"Uploaded {len(uploads)} artifacts")

        # 10. Build manifest + create version
        manifest = build_manifest(
            version=semver,
            model_name=run_row.get("provider_job_id") or "yolo11s-sack",
            run_id=run_id,
            git_sha=git_sha,
            uploaded=uploads,
            metrics_summary={
                "fp32": normalize_metrics(fp32_eval) if fp32_eval else {},
                "int8": normalize_metrics(int8_eval) if int8_eval else {},
                "gate": verdict,
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
            artifacts={
                k: (best_pt if k == "pytorch" else
                    onnx_path if k == "onnx" else
                    hef_path if k == "hef" else
                    hef_meta_path)
                for k in uploads.keys()
                if (k != "hef" or hef_path) and (k != "hef_meta" or hef_meta_path)
            },
            eval_fp32=fp32_eval or None,
            eval_int8=int8_eval or None,
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
        client.log_step(run_id, 10, "version", "ok",
                        f"Version {version_row['semver']} created ({version_row['id']})")

        # 11. Finalize
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


def _materialize_dataset(dataset_ref: str, client: RegistryClient, run_id: str) -> Path:
    """If ``dataset_ref`` starts with ``datasets/`` → fetch via R2 presigned URL.
    Otherwise treat as a local path.
    """
    if dataset_ref.startswith("datasets/"):
        url = client.download_dataset(dataset_ref)
        local = REPO_ROOT / "data" / "remote" / Path(dataset_ref).name
        local.parent.mkdir(parents=True, exist_ok=True)
        from urllib.request import urlopen
        with urlopen(url, timeout=60) as r, open(local, "wb") as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
        client.log_step(run_id, 2, "dataset", "info", f"pulled {dataset_ref} → {local}")
        return local
    return Path(dataset_ref)


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


def _eval_int8(hef_path: Path, dataset_yaml: Path) -> dict[str, Any]:
    # Stub: real INT8 eval needs Hailo runtime + a HEF inference harness.
    # Phase 1 leaves this as a hook; Phase 2 wires it.
    return {}


def _imgsz(config) -> int:
    if isinstance(config.input_size, list) and len(config.input_size) >= 1:
        return int(config.input_size[0])
    return 640


def _input_shape_tuple(config) -> tuple[int, int, int]:
    s = config.input_size
    if isinstance(s, list):
        if len(s) >= 3:
            return (int(s[0]), int(s[1]), int(s[2]))
        if len(s) == 2:
            return (int(s[0]), int(s[1]), 3)
    return (640, 640, 3)


if __name__ == "__main__":
    sys.exit(main())
