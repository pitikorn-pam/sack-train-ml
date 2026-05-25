"""Training orchestration scaffold.

Planned responsibilities:
- load and validate training config
- resolve dataset paths
- materialize runtime dataset YAML
- normalize hardware profile selection
- orchestrate YOLO train entrypoints
"""

from __future__ import annotations

from pathlib import Path


def load_training_config(path: str | Path) -> dict:
    raise NotImplementedError("training config loader not implemented yet")
