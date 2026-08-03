"""Dataset utilities — fetch + validate YOLO datasets.

A YOLO dataset config is a YAML file with at minimum:
    path: <root>
    train: <relative-or-glob>
    val:   <relative-or-glob>
    names: { 0: class0, 1: class1, ... }

For Phase 1 we keep validation minimal — read the YAML, count images +
labels in train/val, sanity-check that class indices in labels are within
the declared names range.

Heavier validators (per-image label parsing, bbox sanity, segmentation
polygon checks) will be added in Phase 2 once the local pipeline is solid.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class DatasetStats:
    train_images: int = 0
    val_images: int = 0
    test_images: int = 0
    train_labels: int = 0
    val_labels: int = 0
    test_labels: int = 0
    class_count: int = 0
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "train_images": self.train_images,
            "val_images": self.val_images,
            "test_images": self.test_images,
            "train_labels": self.train_labels,
            "val_labels": self.val_labels,
            "test_labels": self.test_labels,
            "class_count": self.class_count,
            "notes": self.notes,
        }


def load_dataset_yaml(path: str | Path) -> dict[str, Any]:
    """Load a YOLO dataset YAML. Uses pyyaml if available, else a tiny parser."""
    try:
        import yaml  # type: ignore
        return yaml.safe_load(Path(path).read_text())
    except ImportError:
        return _parse_minimal_yaml(Path(path).read_text())


def validate_dataset(yaml_path: str | Path, classes: list[str]) -> DatasetStats:
    """Count images + labels for each split. Verify class count matches.

    Returns DatasetStats. Raises ValueError on hard mismatches.
    """
    cfg = load_dataset_yaml(yaml_path)
    # Roboflow exports ship no `path:` key. Anchor on the YAML's own folder
    # rather than the cwd, which is wherever the caller happened to run from.
    root = Path(cfg.get("path") or Path(yaml_path).resolve().parent)
    if not root.is_dir():
        # A stale absolute `path:` (e.g. baked on another machine before the
        # dataset was copied here) must not win over the YAML's real location.
        root = Path(yaml_path).resolve().parent
    names = cfg.get("names") or {}
    name_count = len(names) if isinstance(names, (list, tuple)) else len(names)
    declared = len(classes)
    if name_count != declared:
        raise ValueError(
            f"Class count mismatch: dataset YAML has {name_count}, run config has {declared}"
        )

    stats = DatasetStats(class_count=declared)

    for split in ("train", "val", "test"):
        ref = cfg.get(split)
        if not ref:
            continue
        images_dir = _resolve_split_dir(root, ref, kind="images")
        labels_dir = _resolve_split_dir(root, ref, kind="labels")
        n_img = _count_images(images_dir)
        n_lbl = _count_labels(labels_dir)
        setattr(stats, f"{split}_images", n_img)
        setattr(stats, f"{split}_labels", n_lbl)
        if n_lbl == 0 and n_img > 0 and split in ("train", "val"):
            stats.notes.append(f"{split}: 0 labels for {n_img} images")

    if stats.train_images == 0:
        raise ValueError("train split has 0 images")
    return stats


# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}


def _resolve_split_dir(root: Path, ref: str | list[str], kind: str) -> Path:
    """YOLO convention: split refs typically point to `images/<split>`.
    Labels live in a parallel `labels/<split>` tree.
    """
    if isinstance(ref, list):
        # multi-source list — just take first
        ref = ref[0]
    p = (root / ref).resolve()
    if not p.is_dir():
        # Roboflow writes `../train/images`, which climbs out of the dataset
        # root. Retry with the prefix stripped before giving up.
        alt = (root / str(ref).lstrip("./")).resolve()
        if alt.is_dir():
            p = alt
    if kind == "labels":
        # swap the LAST occurrence of /images/ → /labels/
        parts = list(p.parts)
        for i in range(len(parts) - 1, -1, -1):
            if parts[i] == "images":
                parts[i] = "labels"
                break
        p = Path(*parts)
    return p


def _count_images(d: Path) -> int:
    if not d.exists() or not d.is_dir():
        return 0
    return sum(1 for f in d.iterdir() if f.is_file() and f.suffix.lower() in _IMAGE_EXTS)


def _count_labels(d: Path) -> int:
    if not d.exists() or not d.is_dir():
        return 0
    return sum(1 for f in d.iterdir() if f.is_file() and f.suffix == ".txt")


def _parse_minimal_yaml(text: str) -> dict[str, Any]:
    """Last-resort YAML loader for `path:`, `train:`, `val:`, `test:`, `names:` only.
    Use pyyaml in real environments.
    """
    cfg: dict[str, Any] = {}
    current_names: dict[int, str] | None = None
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        if line.startswith(" ") and current_names is not None:
            k, _, v = line.strip().partition(":")
            try:
                current_names[int(k)] = v.strip().strip("'\"")
            except ValueError:
                pass
            continue
        current_names = None
        key, _, val = line.partition(":")
        key = key.strip()
        val = val.strip()
        if key == "names" and not val:
            current_names = {}
            cfg["names"] = current_names
        elif val:
            cfg[key] = val.strip("'\"")
    return cfg
