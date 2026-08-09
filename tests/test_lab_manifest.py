"""Focused contract tests for truthful Lab run manifests."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "webui"))
sys.path.insert(0, str(ROOT / "apps" / "api"))

import lab_core  # noqa: E402
from lab_server import build_run_manifest, _redact_config  # noqa: E402


def test_redact_config_removes_paths_and_secrets():
    result = _redact_config({
        "model_path": "/private/local/model.pt",
        "api_token": "do-not-leak",
        "nested": {"password": "also-secret"},
    }, model_identifier="models/model.pt")
    assert result["model_path"] == "models/model.pt"
    assert result["api_token"] == "<redacted>"
    assert result["nested"]["password"] == "<redacted>"
    assert "/private/local" not in repr(result)
    assert "do-not-leak" not in repr(result)


def test_manifest_contains_real_provenance_and_no_absolute_paths():
    result = lab_core.LabResult(
        video_width=640, video_height=480, fps=25.0, frame_count=12,
        summary={"total": 1, "confirmed": 1, "flagged": 0, "recovered": 0},
        events=[{"event_id": "crossing-000001", "provenance": {"confidence": 0.9}}],
    )
    manifest = build_run_manifest(
        run_id="run-1", created_at="2026-08-10T00:00:00Z", result=result,
        config={"model_path": "/private/local/model.pt", "frame_stride": 2},
        model_identifier="models/model.pt", model_sha256="a" * 64,
        model_size_bytes=123, input_filename="/tmp/camera.mp4",
        input_sha256="b" * 64, video_id="video-1", video_url="/api/lab/video/video-1",
    )
    assert manifest["schema_version"] == "lab.v1"
    assert manifest["run_id"] == "run-1"
    assert manifest["input"]["filename"] == "camera.mp4"
    assert manifest["input"]["sha256"] == "b" * 64
    assert manifest["model"]["identifier"] == "models/model.pt"
    assert manifest["counts"]["events"]["event_ids"] == ["crossing-000001"]
    assert manifest["output"]["video_id"] == "video-1"
    assert "/private/local" not in repr(manifest)
