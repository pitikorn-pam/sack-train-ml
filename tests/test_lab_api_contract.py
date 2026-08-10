"""P1 HTTP contract tests for the backend Lab API.

These tests exercise the real FastAPI application and real serialization paths.
They deliberately avoid loading a YOLO model or running video inference.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "webui"))
sys.path.insert(0, str(ROOT / "apps" / "api"))

import lab_core  # noqa: E402
import lab_server  # noqa: E402


@pytest.fixture()
def client():
    with TestClient(lab_server.app) as test_client:
        yield test_client


def test_health_exposes_lab_capabilities(client):
    response = client.get("/api/lab/health")

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "service": "lab",
        "device_default": "mps",
        "capabilities": {
            "tracker": True,
            "healer": False,
            "scorer": True,
            "optical_flow": False,
        },
        "capability_details": {
            "healer": {
                "enabled": False,
                "supported": False,
                "status": "locked",
                "reason": "requires real path/person evidence, recovery provenance, TTL, and duplicate safeguards",
            },
            "optical_flow": {
                "enabled": False,
                "supported": False,
                "status": "unsupported",
                "reason": "optical-flow predictor is not implemented",
            },
        },
    }


def test_health_capability_metadata_is_json_safe_and_preserves_legacy_flags(client):
    payload = client.get("/api/lab/health").json()

    assert payload["capabilities"]["tracker"] is True
    assert payload["capabilities"]["healer"] is False
    assert payload["capabilities"]["scorer"] is True
    assert payload["capabilities"]["optical_flow"] is False
    for capability in ("healer", "optical_flow"):
        details = payload["capability_details"][capability]
        assert details["enabled"] is False
        assert details["supported"] is False
        assert details["status"] in {"locked", "unsupported"}
        assert details["reason"]
    json.dumps(payload)


def test_models_returns_safe_identifiers_and_config(client):
    response = client.get("/api/lab/models")

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload["models"], list)
    assert payload["default"] in payload["models"]
    assert not any(Path(value).is_absolute() for value in payload["models"])
    assert not Path(payload["default"]).is_absolute()
    assert not Path(payload["defaults"]["model_path"]).is_absolute()
    serialized = json.dumps(payload)
    assert "/Users/" not in serialized
    assert "/private/" not in serialized
    assert not any(secret in serialized.lower() for secret in ("password", "token", "api_key", "secret"))


@pytest.mark.parametrize(
    ("config", "expected_detail"),
    [
        ("{not-json", "invalid JSON config"),
        ("[]", "config must be a JSON object"),
        (json.dumps({"line": [1, 2, 3]}), "invalid config"),
        (json.dumps({"line": [0, 0, 0, 0]}), "invalid config"),
        (json.dumps({"line": {"x1": 0, "y1": 0, "x2": 1, "y2": 1}}), "invalid config"),
        (json.dumps({"exclusion_zones": [{"zone_id": "bad", "points": [[0, 0], [1, 1]]}]}), "invalid config"),
        (json.dumps({"exclusion_zones": [{"zone_id": "bad", "points": [[0, 0], [2, 2], [0, 2], [2, 0]]}]}), "invalid config"),
    ],
)
def test_infer_rejects_malformed_config_before_inference(client, config, expected_detail):
    response = client.post(
        "/api/lab/infer",
        files={"video": ("sample.mp4", b"not-a-video", "video/mp4")},
        data={"config": config},
    )

    assert response.status_code in (400, 422)
    assert expected_detail in response.json()["detail"]


def test_infer_job_rejects_malformed_config_before_queueing(client):
    response = client.post(
        "/api/lab/infer/jobs",
        files={"video": ("sample.mp4", b"not-a-video", "video/mp4")},
        data={"config": "{not-json"},
    )

    assert response.status_code == 400
    assert "invalid JSON config" in response.json()["detail"]


def test_runs_has_explicit_process_local_persistence_envelope(client):
    response = client.get("/api/lab/runs")

    assert response.status_code == 200
    payload = response.json()
    assert payload["schema_version"] == "lab.v1"
    assert payload["persistent"] is False
    assert isinstance(payload["runs"], list)


def test_detection_only_result_keeps_counting_fields_null_without_line():
    result = lab_core.LabResult(
        frames_processed=3,
        frames_total=3,
        max_sack_per_frame=2,
        avg_sack_per_frame=1.0,
        config={"line": None},
    )
    payload = {
        key: value
        for key, value in vars(result).items()
        if key != "output_video"
    }

    assert payload["confirmed"] is None
    assert payload["flagged"] is None
    assert payload["recovered"] is None
    assert payload["per_crossing"] == []
    assert payload["events"] == []
    assert payload["summary"] == {}
    assert payload["config"]["line"] is None


def test_detection_only_result_exposes_truthful_backend_diagnostics():
    result = lab_core.LabResult(
        frames_processed=2,
        frames_total=2,
        detection_diagnostics=lab_core.aggregate_detection_diagnostics([
            {"frame_index": 0, "detections": [
                {"class_id": 1, "confidence": 0.9},
                {"class_id": 0, "confidence": 0.1},
            ]},
            {"frame_index": 2, "detections": []},
        ]),
    )

    payload = {key: value for key, value in vars(result).items() if key != "output_video"}
    diagnostics = payload["detection_diagnostics"]
    assert diagnostics["total_detections"] == 2
    assert diagnostics["detections_by_class"] == {"0": 1, "1": 1}
    assert diagnostics["frames_with_detections"] == 1
    assert diagnostics["sampled_frame_density"] == [{
        "frame_index": 0,
        "detection_count": 2,
        "class_counts": {"0": 1, "1": 1},
    }]
    assert [bin_["count"] for bin_ in diagnostics["confidence_histogram"]["bins"]] == [1, 0, 0, 0, 1]


def test_detection_diagnostics_sampling_is_bounded_and_json_safe():
    frames = [{"frame_index": index, "detections": [{"class_id": 1, "confidence": 0.5}]} for index in range(250)]

    diagnostics = lab_core.aggregate_detection_diagnostics(frames, max_samples=7)

    assert len(diagnostics["sampled_frame_density"]) == 7
    assert diagnostics["sampled_frame_density"][0]["frame_index"] == 0
    assert diagnostics["sampled_frame_density"][-1]["frame_index"] == 249
    json.dumps(diagnostics)


def test_job_progress_snapshot_is_truthful_and_bounded():
    job = lab_server._new_job()

    assert lab_server._job_status_payload(job)["status"] == "queued"
    assert lab_server._job_status_payload(job)["progress"] == 0

    lab_server._update_job_progress(job["job_id"], 0.4, "frame 4/10")
    snapshot = lab_server._job_status_payload(job)
    assert snapshot["status"] == "running"
    assert snapshot["progress"] == 0.4
    assert snapshot["processed_frames"] == 4
    assert snapshot["total_frames"] == 10

    lab_server._finish_job(job["job_id"], status="succeeded", result={"ok": True})
    assert lab_server._job_status_payload(job)["result"] == {"ok": True}


def test_job_failure_does_not_expose_partial_result():
    job = lab_server._new_job()
    lab_server._finish_job(job["job_id"], status="failed", message="boom", result={"secret": True})

    snapshot = lab_server._job_status_payload(job)
    assert snapshot["status"] == "failed"
    assert snapshot["message"] == "boom"
    assert "result" not in snapshot
