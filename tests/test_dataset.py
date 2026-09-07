"""Dataset validation — the gate that stops a run before Colab boots.

A wrong dataset is the cheapest failure to catch and the most expensive to discover
late: the alternative is a session that boots, downloads, trains, and produces a model
of the wrong thing. This module had no test, and two of its behaviours exist because
real exports broke on them — Roboflow ships no `path:` key, and writes split refs like
`../train/images` that climb out of the dataset root.

    pytest tests/test_dataset.py
"""
from __future__ import annotations

import pytest

from sack_train_ml.dataset import DatasetStats, load_dataset_yaml, validate_dataset


def _make_dataset(root, *, splits=("train", "val"), images=3, labels=3, names=("person", "sack"),
                  path_key=None, ref_style="images/{split}"):
    """Write a YOLO dataset on disk and return the path to its data.yaml."""
    for split in splits:
        img_dir = root / "images" / split
        lbl_dir = root / "labels" / split
        img_dir.mkdir(parents=True, exist_ok=True)
        lbl_dir.mkdir(parents=True, exist_ok=True)
        for i in range(images):
            (img_dir / f"{i}.jpg").write_bytes(b"\xff\xd8\xff")
        for i in range(labels):
            (lbl_dir / f"{i}.txt").write_text("0 0.5 0.5 0.1 0.1\n")

    lines = []
    if path_key is not None:
        lines.append(f"path: {path_key}")
    for split in splits:
        lines.append(f"{split}: {ref_style.format(split=split)}")
    lines.append("names:")
    for i, n in enumerate(names):
        lines.append(f"  {i}: {n}")
    yaml_path = root / "data.yaml"
    yaml_path.write_text("\n".join(lines) + "\n")
    return yaml_path


def test_a_well_formed_dataset_counts_correctly(tmp_path):
    y = _make_dataset(tmp_path, images=4, labels=4)
    stats = validate_dataset(y, ["person", "sack"])
    assert stats.train_images == 4
    assert stats.train_labels == 4
    assert stats.val_images == 4
    assert stats.class_count == 2
    assert stats.notes == []


def test_a_class_count_mismatch_is_refused_before_anything_downloads(tmp_path):
    """The failure this exists to prevent: two classes in the run config, three in the
    dataset, and a model that trains perfectly on the wrong contract."""
    y = _make_dataset(tmp_path, names=("person", "sack", "pallet"))
    with pytest.raises(ValueError, match="Class count mismatch"):
        validate_dataset(y, ["person", "sack"])


def test_an_empty_train_split_is_refused(tmp_path):
    y = _make_dataset(tmp_path, images=0, labels=0)
    with pytest.raises(ValueError, match="train split has 0 images"):
        validate_dataset(y, ["person", "sack"])


def test_images_without_labels_are_noted_not_fatal(tmp_path):
    """A split with images and no labels can be legitimate mid-annotation, so it warns
    rather than refusing — but it must not pass silently."""
    y = _make_dataset(tmp_path, images=3, labels=0)
    stats = validate_dataset(y, ["person", "sack"])
    assert any("0 labels" in note for note in stats.notes)
    assert stats.train_images == 3


def test_a_roboflow_export_with_no_path_key_anchors_on_the_yaml(tmp_path):
    """Roboflow ships no `path:`. Anchoring on the cwd instead of the YAML's own folder
    would make validation depend on where the caller happened to run from."""
    y = _make_dataset(tmp_path, path_key=None)
    stats = validate_dataset(y, ["person", "sack"])
    assert stats.train_images == 3


def test_a_stale_absolute_path_does_not_win_over_the_real_location(tmp_path):
    """A `path:` baked on another machine before the dataset was copied here points at
    nothing. The YAML's own folder is the fallback that keeps the run alive."""
    y = _make_dataset(tmp_path, path_key="/nonexistent/machine/that/never/existed")
    stats = validate_dataset(y, ["person", "sack"])
    assert stats.train_images == 3


def test_a_ref_that_climbs_out_of_the_root_still_resolves(tmp_path):
    """Roboflow writes `../train/images`. The retry with the prefix stripped is what
    makes those exports work at all."""
    y = _make_dataset(tmp_path, ref_style="./images/{split}")
    assert validate_dataset(y, ["person", "sack"]).train_images == 3


def test_a_test_split_is_optional(tmp_path):
    y = _make_dataset(tmp_path, splits=("train", "val"))
    stats = validate_dataset(y, ["person", "sack"])
    assert stats.test_images == 0


def test_a_missing_split_directory_counts_zero_rather_than_raising(tmp_path):
    y = _make_dataset(tmp_path)
    y.write_text(y.read_text() + "test: images/test\n")
    stats = validate_dataset(y, ["person", "sack"])
    assert stats.test_images == 0


def test_stats_serialise_for_the_registry(tmp_path):
    import json

    y = _make_dataset(tmp_path)
    d = validate_dataset(y, ["person", "sack"]).to_dict()
    assert set(d) >= {"train_images", "val_images", "class_count", "notes"}
    json.dumps(d)


def test_the_yaml_loader_reads_names_as_a_mapping(tmp_path):
    y = _make_dataset(tmp_path)
    cfg = load_dataset_yaml(y)
    assert len(cfg["names"]) == 2


def test_an_empty_stats_object_is_all_zeros():
    s = DatasetStats()
    assert s.train_images == 0 and s.class_count == 0 and s.notes == []
