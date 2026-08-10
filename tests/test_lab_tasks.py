"""Durable LabTask API contract tests."""
from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "webui"))
sys.path.insert(0, str(ROOT / "apps" / "api"))

import lab_server  # noqa: E402


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "tasks.sqlite3"
    monkeypatch.setenv("LAB_TASKS_DB", str(db_path))
    importlib.reload(lab_server)
    with TestClient(lab_server.app) as test_client:
        yield test_client


def test_task_crud_persists_sanitized_contract(client):
    response = client.post("/api/lab/tasks", json={
        "name": "  Night run  ",
        "description": "Reusable task",
        "status": "active",
        "config": {"model_path": "/Users/alice/model.pt", "api_token": "secret-value", "frame_stride": 2},
        "source": {"filename": "/tmp/video.mp4", "path": "/private/video.mp4", "bytes": "do-not-store"},
        "model": {"path": "/Users/alice/model.pt", "sha256": "a" * 64, "size_bytes": 123},
        "run_ids": ["run-1"],
        "latest_run_id": "run-1",
    })
    assert response.status_code == 201
    task = response.json()
    assert task["name"] == "Night run"
    assert task["status"] == "active"
    serialized = json.dumps(task)
    assert "/Users/" not in serialized and "/private/" not in serialized and "secret-value" not in serialized
    assert "bytes" not in task["source"]

    task_id = task["task_id"]
    assert client.get(f"/api/lab/tasks/{task_id}").json()["task_id"] == task_id
    listed = client.get("/api/lab/tasks").json()
    assert listed["tasks"][0]["task_id"] == task_id

    patched = client.patch(f"/api/lab/tasks/{task_id}", json={"description": "Updated", "status": "archived"})
    assert patched.status_code == 200
    assert patched.json()["description"] == "Updated"
    assert patched.json()["status"] == "archived"


def test_task_data_survives_module_reload(client, tmp_path, monkeypatch):
    created = client.post("/api/lab/tasks", json={"name": "Persistent"}).json()
    db_path = tmp_path / "tasks.sqlite3"
    monkeypatch.setenv("LAB_TASKS_DB", str(db_path))
    reloaded = importlib.reload(lab_server)
    with TestClient(reloaded.app) as fresh_client:
        assert fresh_client.get(f"/api/lab/tasks/{created['task_id']}").status_code == 200


def test_task_validation_and_unknown_id(client):
    assert client.post("/api/lab/tasks", json={"name": ""}).status_code == 422
    assert client.post("/api/lab/tasks", json={"name": "x", "status": "running"}).status_code == 422
    assert client.post("/api/lab/tasks", json={"name": "x", "config": ["bad"]}).status_code == 422
    assert client.get("/api/lab/tasks/not-found").status_code == 404
    assert client.patch("/api/lab/tasks/not-found", json={"name": "x"}).status_code == 404


def test_task_list_bounds_and_secret_redaction_helper():
    sanitized = lab_server._sanitize_task_value({
        "password": "pw", "nested": {"token": "tok"}, "absolute": "/Users/me/file", "blob": b"bytes"
    })
    assert sanitized == {"password": "<redacted>", "nested": {"token": "<redacted>"}, "absolute": "<redacted>", "blob": "<redacted>"}
