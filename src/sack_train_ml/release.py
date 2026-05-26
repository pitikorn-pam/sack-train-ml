"""Release bundle assembly — write the on-disk artifact set + manifest.

The release bundle has a fixed layout:

    {bundle_dir}/
      best.pt
      model.onnx
      model.hef
      model.hef.meta.yaml
      eval-fp32.json
      eval-int8.json
      release-manifest.json   ← top-level descriptor

The same artifact metadata is also pushed into Supabase ``versions.artifacts``
JSONB so the runtime / dashboard can find them without touching the bundle.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from .contracts import ArtifactRecord, ReleaseManifest


def assemble_bundle(
    bundle_dir: str | Path,
    artifacts: dict[str, Path],
    eval_fp32: dict[str, Any] | None,
    eval_int8: dict[str, Any] | None,
    manifest: ReleaseManifest,
) -> Path:
    """Copy artifacts into ``bundle_dir`` and write the manifest. Returns dir path."""
    bundle = Path(bundle_dir)
    bundle.mkdir(parents=True, exist_ok=True)

    name_map = {
        "pytorch": "best.pt",
        "onnx": "model.onnx",
        "hef": "model.hef",
        "hef_meta": "model.hef.meta.yaml",
    }
    for kind, src in artifacts.items():
        dst_name = name_map.get(kind, Path(src).name)
        shutil.copy2(src, bundle / dst_name)

    if eval_fp32 is not None:
        (bundle / "eval-fp32.json").write_text(json.dumps(eval_fp32, indent=2))
    if eval_int8 is not None:
        (bundle / "eval-int8.json").write_text(json.dumps(eval_int8, indent=2))

    manifest.write(bundle / "release-manifest.json")
    return bundle


def build_manifest(
    version: str,
    model_name: str,
    run_id: str,
    git_sha: str | None,
    uploaded: dict[str, ArtifactRecord],
    metrics_summary: dict[str, Any],
    class_names: list[str],
    input_size: list[int],
    task: str,
    output_kind: str,
) -> ReleaseManifest:
    return ReleaseManifest(
        version=version,
        model_name=model_name,
        run_id=run_id,
        git_sha=git_sha,
        artifacts=uploaded,
        metrics_summary=metrics_summary,
        class_names=class_names,
        input_size=input_size,
        task=task,
        output_kind=output_kind,
    )
