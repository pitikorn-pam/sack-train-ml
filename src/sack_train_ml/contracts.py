"""Contracts — typed dataclasses for the training pipeline.

These are the data structures that flow between tools (training → eval →
export → compile → release) and between this repo and Supabase / R2.

Design rule (Phase 1, D2=B): a single ``artifacts`` mapping carries all
artifact records — no hardcoded fields for specific kinds. Add a new
artifact kind by writing a new key; no schema change anywhere.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Literal


ArtifactKind = Literal["pytorch", "onnx", "hef", "hef_meta"]


# ----------------------------------------------------------------------------
# Run config — pulled from Supabase ``runs.config_yaml``
# ----------------------------------------------------------------------------

@dataclass
class RunConfig:
    """The training configuration loaded from a Supabase ``runs`` row.

    All fields are sourced from ``runs.config_yaml`` JSONB. The Python loader
    is permissive — missing optional keys default to None; missing required
    keys raise ``ValueError`` at load time.
    """

    # Required ---------------------------------------------------------------
    source_weights: str          # e.g. "yolo11s.pt"
    dataset: str                 # local path or R2 key starting with "datasets/"
    classes: list[str]           # ordered class names, e.g. ["sack"]
    input_size: list[int]        # [h, w] or [h, w, c]
    task: str                    # "detection" | "segmentation" | ...
    output_kind: str             # "detection-boxes" | "detection-masks" | ...

    # Optional ---------------------------------------------------------------
    hyperparameters: dict[str, Any] = field(default_factory=dict)
    export_options: dict[str, Any] = field(default_factory=dict)
    # When ``compile_hef`` is true the training run also compiles an INT8 .hef
    # in the same Colab session (see hailo_pipeline). Keys:
    #   compile_hef: bool          — enable the HEF compile phase
    #   opt_level:   int (0|2)     — 0 = fast/basic (proven); 2 = production (calib>=1024)
    #   calib_n:     int           — # calibration images sampled from the dataset
    #   wheel_key:   str           — R2 key for the gated DFC wheel (tools/...)
    #   scores_th / iou_th / max_per_class / reg_len — NMS contract overrides
    compile_options: dict[str, Any] = field(default_factory=dict)
    dataset_bundle: str | None = None
    dataset_stats: dict[str, Any] = field(default_factory=dict)
    logs: list[dict[str, Any]] = field(default_factory=list)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "RunConfig":
        required = ["source_weights", "dataset", "classes", "input_size", "task", "output_kind"]
        missing = [k for k in required if k not in d]
        if missing:
            raise ValueError(f"RunConfig missing required keys: {missing}")
        return cls(
            source_weights=d["source_weights"],
            dataset=d["dataset"],
            classes=list(d["classes"]),
            input_size=list(d["input_size"]),
            task=d["task"],
            output_kind=d["output_kind"],
            hyperparameters=dict(d.get("hyperparameters", {})),
            export_options=dict(d.get("export_options", {})),
            compile_options=dict(d.get("compile_options", {})),
            dataset_bundle=d.get("dataset_bundle"),
            dataset_stats=dict(d.get("dataset_stats", {})),
            logs=list(d.get("logs", [])),
        )


# ----------------------------------------------------------------------------
# Artifact + release manifest
# ----------------------------------------------------------------------------

@dataclass
class ArtifactRecord:
    """One artifact in the release bundle.

    Persisted into ``versions.artifacts`` JSONB keyed by ``kind``.
    """

    kind: ArtifactKind
    key: str                          # R2 key (e.g. "runs/abc/v1.0.0.hef")
    size_bytes: int
    sha256: str
    quantization: dict[str, Any] | None = None
    packaging: str | None = None      # e.g. "tar.gz" if bundled

    def to_jsonb(self) -> dict[str, Any]:
        d = {"key": self.key, "size_bytes": self.size_bytes, "sha256": self.sha256}
        if self.quantization is not None:
            d["quantization"] = self.quantization
        if self.packaging is not None:
            d["packaging"] = self.packaging
        return d


@dataclass
class ReleaseManifest:
    """Top-level descriptor written next to the artifacts in the release bundle.

    Mirrors what gets inserted into ``versions`` row metadata column.
    """

    version: str                          # semver, e.g. "1.0.0-{run_id[:8]}"
    model_name: str
    run_id: str
    git_sha: str | None
    artifacts: dict[str, ArtifactRecord]  # keyed by ArtifactKind
    metrics_summary: dict[str, Any] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)
    class_names: list[str] = field(default_factory=list)
    input_size: list[int] = field(default_factory=list)
    task: str = ""
    output_kind: str = ""

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True)

    def write(self, path: str | Path) -> Path:
        p = Path(path)
        p.write_text(self.to_json())
        return p


# ----------------------------------------------------------------------------
# Hashing helper — shared by upload + manifest
# ----------------------------------------------------------------------------

def sha256_file(path: str | Path, chunk: int = 1 << 20) -> tuple[str, int]:
    """Return ``("sha256:<hex>", size_bytes)`` for ``path``."""
    h = hashlib.sha256()
    size = 0
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
            size += len(block)
    return f"sha256:{h.hexdigest()}", size
