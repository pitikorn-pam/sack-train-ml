"""Artifact and release contract scaffolding.

This module is intentionally light for now.
It exists to anchor future typed metadata builders for:
- training runs
- fp32 / int8 evaluation summaries
- HEF metadata
- release manifests
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ArtifactRecord:
    kind: str
    path: str
    sha256: str | None = None
    size_bytes: int | None = None


@dataclass
class ReleaseManifest:
    version: str
    model_name: str
    artifacts: list[ArtifactRecord] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
