"""The release bundle — what actually leaves this repo.

A bundle is the artifact set plus the manifest that names it, and it is the last point
where a wrong name or a missing file is cheap to notice. It had no test, and its
bundle-name map had already drifted: `effective_config` was absent, so the provenance
artifact would have landed under a temp-file name.

    pytest tests/test_release.py
"""
from __future__ import annotations

import json

import pytest

from sack_train_ml.contract import artifact_kinds
from sack_train_ml.contracts import ArtifactRecord, sha256_file
from sack_train_ml.release import assemble_bundle, build_manifest


@pytest.fixture()
def artifacts(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    made = {}
    for kind, spec in artifact_kinds().items():
        f = src / f"whatever-temp-name.{spec['extension']}"
        f.write_bytes(f"contents of {kind}".encode())
        made[kind] = f
    return made


@pytest.fixture()
def manifest():
    return build_manifest(
        version="1.0.0-abc12345",
        model_name="yolo11s-sack-hailo8l",
        run_id="abc12345-0000-0000-0000-000000000000",
        git_sha="deadbeef",
        uploaded={},
        metrics_summary={"fp32": {"map50": 0.91}},
        class_names=["person", "sack"],
        input_size=[640, 640, 3],
        task="detection",
        output_kind="detection-boxes",
    )


def test_every_artifact_kind_lands_under_its_stable_name(tmp_path, artifacts, manifest):
    """The defect this guards: a kind missing from the name map is copied under whatever
    the temp file was called, which is unreproducible and unfindable."""
    bundle = assemble_bundle(tmp_path / "bundle", artifacts, None, None, manifest)
    for kind, spec in artifact_kinds().items():
        assert (bundle / spec["bundleName"]).exists(), f"{kind} is missing from the bundle"
    assert not list(bundle.glob("whatever-temp-name*")), "an artifact kept its temp name"


def test_the_bundle_carries_its_manifest(tmp_path, artifacts, manifest):
    bundle = assemble_bundle(tmp_path / "bundle", artifacts, None, None, manifest)
    written = json.loads((bundle / "release-manifest.json").read_text())
    assert written["version"] == "1.0.0-abc12345"
    assert written["class_names"] == ["person", "sack"]
    assert written["task"] == "detection"


def test_evals_are_written_only_when_present(tmp_path, artifacts, manifest):
    bundle = assemble_bundle(tmp_path / "b1", artifacts, {"map50": 0.9}, None, manifest)
    assert (bundle / "eval-fp32.json").exists()
    assert not (bundle / "eval-int8.json").exists(), (
        "an absent INT8 eval must not be written as an empty file — it would read as "
        "a measurement that returned nothing rather than one that never ran"
    )


def test_both_evals_round_trip(tmp_path, artifacts, manifest):
    bundle = assemble_bundle(tmp_path / "b", artifacts, {"map50": 0.91}, {"map50": 0.89}, manifest)
    assert json.loads((bundle / "eval-fp32.json").read_text())["map50"] == 0.91
    assert json.loads((bundle / "eval-int8.json").read_text())["map50"] == 0.89


def test_an_unknown_kind_keeps_its_own_filename_rather_than_being_dropped(tmp_path, manifest):
    """Falling back to the source name is right: losing the file silently would be worse
    than an unconventional name in the bundle."""
    odd = tmp_path / "something.bin"
    odd.write_bytes(b"x")
    bundle = assemble_bundle(tmp_path / "bundle", {"mystery": odd}, None, None, manifest)
    assert (bundle / "something.bin").exists()


def test_the_bundle_directory_is_created_if_absent(tmp_path, artifacts, manifest):
    target = tmp_path / "deep" / "nested" / "bundle"
    assert assemble_bundle(target, artifacts, None, None, manifest).is_dir()


def test_copied_bytes_are_identical_to_the_source(tmp_path, artifacts, manifest):
    """copy2, not a re-write: an artifact whose bytes changed on the way into a bundle
    would break every sha256 the registry recorded for it."""
    bundle = assemble_bundle(tmp_path / "bundle", artifacts, None, None, manifest)
    for kind, src in artifacts.items():
        dst = bundle / artifact_kinds()[kind]["bundleName"]
        assert sha256_file(dst) == sha256_file(src), f"{kind} changed on the way into the bundle"


def test_build_manifest_passes_every_field_through():
    m = build_manifest(
        version="9.9.9", model_name="m", run_id="r", git_sha=None,
        uploaded={"pytorch": ArtifactRecord(kind="pytorch", key="runs/r/m.pt",
                                            size_bytes=1, sha256="h")},
        metrics_summary={}, class_names=["a"], input_size=[320, 320, 3],
        task="detection", output_kind="detection-boxes",
    )
    assert m.version == "9.9.9"
    assert m.git_sha is None
    assert m.artifacts["pytorch"].key == "runs/r/m.pt"
    assert m.artifacts["pytorch"].to_jsonb() == {"key": "runs/r/m.pt", "size_bytes": 1, "sha256": "h"}
