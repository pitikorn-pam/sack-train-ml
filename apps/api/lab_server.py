"""lab_server — FastAPI inference backend for the Sack-Detector-Edge Lab tab.

The React Lab tab (apps/web/src/sections/Lab.tsx) calls these endpoints; Vite
proxies /api -> here (see apps/web/vite.config.ts). Inference logic lives in
webui/lab_core.py (shared, no web deps).

Run:  /Users/pitikorn/Work/BSCP/sack-train-ml/.venv/bin/python apps/api/lab_server.py
Serves on http://127.0.0.1:8077 .

Loom Oracle (AI), 2026-08-09.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import sqlite3
import sys
import tempfile
import threading
import uuid
from collections import OrderedDict
from datetime import datetime, timezone
from dataclasses import asdict
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent.parent   # sack-train-ml/
sys.path.insert(0, str(_ROOT / "webui"))
import lab_core  # noqa: E402

from fastapi import FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import FileResponse, JSONResponse  # noqa: E402

app = FastAPI(title="Sack-Detector-Edge Lab API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

_VIDEO_STORE: dict[str, str] = {}   # video_id -> output mp4 path
_RUN_HISTORY: dict[str, dict] = {}  # bounded, process-local truthful history
MAX_RUN_HISTORY = 100
RUN_SCHEMA_VERSION = "lab.v1"
MAX_JOB_STORE = 100
MAX_MANIFEST_EVENT_RECORDS = 1000
_JOB_STORE: OrderedDict[str, dict] = OrderedDict()
_JOB_LOCK = threading.RLock()

TASK_STATUSES = {"draft", "active", "archived"}
MAX_TASK_NAME = 200
MAX_TASK_DESCRIPTION = 5000
MAX_TASK_LIST_ITEMS = 100
MAX_TASK_ID_LENGTH = 128
_TASK_DB_DEFAULT = _ROOT / "runs" / "lab_tasks.sqlite3"


def _task_db_path() -> Path:
    return Path(os.environ.get("LAB_TASKS_DB", str(_TASK_DB_DEFAULT))).expanduser()


def _task_connection() -> sqlite3.Connection:
    path = _task_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("""
        CREATE TABLE IF NOT EXISTS lab_tasks (
            task_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
            config_json TEXT NOT NULL,
            source_json TEXT NOT NULL,
            model_json TEXT NOT NULL,
            run_ids_json TEXT NOT NULL,
            latest_run_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    connection.commit()
    return connection


def _sanitize_task_value(value: object, *, _depth: int = 0) -> object:
    """Bound JSON metadata and remove secrets, bytes, and local filesystem paths."""
    if _depth > 8:
        return "<redacted>"
    secret_words = ("secret", "password", "token", "api_key", "apikey", "credential")
    if isinstance(value, dict):
        result = {}
        for key, item in list(value.items())[:100]:
            key_text = str(key)
            if key_text.lower() in {"bytes", "content", "file_bytes", "uploaded_file"}:
                continue
            if any(word in key_text.lower() for word in secret_words):
                result[key_text] = "<redacted>"
            elif isinstance(item, (bytes, bytearray, memoryview)):
                result[key_text] = "<redacted>"
            else:
                result[key_text] = _sanitize_task_value(item, _depth=_depth + 1)
        return result
    if isinstance(value, (list, tuple)):
        return [_sanitize_task_value(item, _depth=_depth + 1) for item in list(value)[:MAX_TASK_LIST_ITEMS]]
    if isinstance(value, (bytes, bytearray, memoryview, Path)):
        return "<redacted>"
    if isinstance(value, str):
        if value.startswith(("/", "~", "file://")) or re.match(r"^[A-Za-z]:[\\/]", value):
            return "<redacted>"
        return value[:1000]
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return str(value)[:1000]


def _task_json(value: object) -> str:
    return json.dumps(_sanitize_task_value(value), separators=(",", ":"), allow_nan=False)


def _task_from_row(row: sqlite3.Row) -> dict:
    return {
        "task_id": row["task_id"], "name": row["name"], "description": row["description"],
        "status": row["status"], "config": json.loads(row["config_json"]),
        "source": json.loads(row["source_json"]), "model": json.loads(row["model_json"]),
        "run_ids": json.loads(row["run_ids_json"]), "latest_run_id": row["latest_run_id"],
        "created_at": row["created_at"], "updated_at": row["updated_at"],
    }


def _validate_task_payload(payload: object, *, partial: bool = False) -> dict:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="task payload must be a JSON object")
    allowed = {"name", "description", "status", "config", "source", "model", "run_ids", "latest_run_id"}
    result = {key: payload[key] for key in allowed if key in payload}
    if not partial and not isinstance(result.get("name"), str):
        raise HTTPException(status_code=422, detail="name must be a non-empty string")
    if "name" in result:
        result["name"] = result["name"].strip()
        if not result["name"] or len(result["name"]) > MAX_TASK_NAME:
            raise HTTPException(status_code=422, detail="name must be 1-200 characters")
    if "description" in result:
        if not isinstance(result["description"], str) or len(result["description"]) > MAX_TASK_DESCRIPTION:
            raise HTTPException(status_code=422, detail="description must be at most 5000 characters")
    if "status" in result and result["status"] not in TASK_STATUSES:
        raise HTTPException(status_code=422, detail="status must be draft, active, or archived")
    for field in ("config", "source", "model"):
        if field in result and not isinstance(result[field], dict):
            raise HTTPException(status_code=422, detail=f"{field} must be a JSON object")
    if "run_ids" in result:
        if not isinstance(result["run_ids"], list) or len(result["run_ids"]) > MAX_TASK_LIST_ITEMS:
            raise HTTPException(status_code=422, detail="run_ids must be a bounded list")
        if any(not isinstance(item, str) or not item or len(item) > MAX_TASK_ID_LENGTH for item in result["run_ids"]):
            raise HTTPException(status_code=422, detail="run_ids must contain bounded strings")
    if "latest_run_id" in result and result["latest_run_id"] is not None:
        if not isinstance(result["latest_run_id"], str) or len(result["latest_run_id"]) > MAX_TASK_ID_LENGTH:
            raise HTTPException(status_code=422, detail="latest_run_id must be a bounded string")
    return result


def _get_task(task_id: str) -> dict:
    with _task_connection() as connection:
        row = connection.execute("SELECT * FROM lab_tasks WHERE task_id = ?", (task_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="task not found")
    return _task_from_row(row)


def _associate_run(task_id: str | None, run_id: str) -> None:
    if not task_id:
        return
    with _task_connection() as connection:
        row = connection.execute("SELECT run_ids_json FROM lab_tasks WHERE task_id = ?", (task_id,)).fetchone()
        if row is None:
            return
        run_ids = json.loads(row["run_ids_json"])
        if run_id not in run_ids:
            run_ids.append(run_id)
        run_ids = run_ids[-MAX_TASK_LIST_ITEMS:]
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        connection.execute("UPDATE lab_tasks SET run_ids_json = ?, latest_run_id = ?, updated_at = ? WHERE task_id = ?",
                           (_task_json(run_ids), run_id, now, task_id))
        connection.commit()

# Upload limits are enforced while streaming to disk, rather than after reading
# the whole multipart part into memory.  The model limit is intentionally
# documented here because it is part of the Lab API wire contract.
MAX_MODEL_UPLOAD_BYTES = 512 * 1024 * 1024
MAX_VIDEO_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024
_UPLOAD_CHUNK_BYTES = 1024 * 1024
_MODEL_CONTENT_TYPES = {
    "application/octet-stream",
    "application/x-pytorch",
    "binary/octet-stream",
}

# These are deliberately locked until the backend has the evidence and
# safeguards needed to make recovery claims auditable.  Keep this metadata
# primitive-only so the health response remains safe for JSON clients.
_CAPABILITY_DETAILS = {
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
}


async def _persist_upload(
    upload: UploadFile,
    *,
    suffix: str,
    max_bytes: int,
    label: str,
    hash_upload: bool = False,
) -> tuple[str, int, str | None]:
    """Stream an UploadFile to a private temporary file with a hard size cap."""
    path: str | None = None
    total = 0
    digest = hashlib.sha256() if hash_upload else None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as out:
            path = out.name
            while True:
                chunk = await upload.read(_UPLOAD_CHUNK_BYTES)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"{label} upload exceeds maximum size of {max_bytes} bytes",
                    )
                out.write(chunk)
                if digest:
                    digest.update(chunk)
    except Exception:
        if path is not None:
            Path(path).unlink(missing_ok=True)
        raise
    return path, total, digest.hexdigest() if digest else None


def _normalize_line(value: object) -> tuple[int, int, int, int] | None:
    if value is None:
        return None
    if isinstance(value, dict):
        required = ("x1", "y1", "x2", "y2", "coordinate_space", "frame_ref", "inflip")
        if any(key not in value for key in required):
            raise ValueError("line object is missing required fields")
        if value["coordinate_space"] != "pixel":
            raise ValueError("line.coordinate_space must be pixel")
        frame_ref = value["frame_ref"]
        if isinstance(frame_ref, bool) or not isinstance(frame_ref, (int, float)) or not math.isfinite(float(frame_ref)):
            raise ValueError("line.frame_ref must be a finite number")
        if not isinstance(value["inflip"], bool):
            raise ValueError("line.inflip must be boolean")
        value = [value[key] for key in ("x1", "y1", "x2", "y2")]
    if not isinstance(value, (list, tuple)) or len(value) != 4:
        raise ValueError("line must be a 4-item list/tuple or canonical object")
    if any(isinstance(point, bool) or not isinstance(point, (int, float)) or not math.isfinite(float(point)) for point in value):
        raise ValueError("line coordinates must be finite numbers")
    x1, y1, x2, y2 = (int(point) for point in value)
    return x1, y1, x2, y2


def _model_id(path: str | Path) -> str:
    """Return a model path relative to the configured model directory."""
    root = lab_core.MODELS_DIR.resolve()
    candidate = Path(path).resolve()
    try:
        return candidate.relative_to(root).as_posix()
    except ValueError as exc:
        raise ValueError("model path must resolve inside the Lab models directory") from exc


def _redact_config(value: object, *, model_identifier: str | None = None) -> object:
    """Return a JSON-safe config snapshot without secrets or local paths."""
    secret_words = ("secret", "password", "token", "api_key", "apikey", "credential")
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            key_text = str(key).lower()
            if any(word in key_text for word in secret_words):
                result[key] = "<redacted>"
            elif key == "model_path":
                result[key] = model_identifier or "<redacted>"
            else:
                result[key] = _redact_config(item, model_identifier=model_identifier)
        return result
    if isinstance(value, (list, tuple)):
        return [_redact_config(item, model_identifier=model_identifier) for item in value]
    if isinstance(value, Path):
        return "<redacted>"
    return value


def _sha256_file(path: str | Path) -> str | None:
    candidate = Path(path)
    if not candidate.is_file():
        return None
    digest = hashlib.sha256()
    with candidate.open("rb") as stream:
        for chunk in iter(lambda: stream.read(_UPLOAD_CHUNK_BYTES), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _manifest_scalar(value: object) -> object:
    """Keep event reference values JSON-safe and free of path-like payloads."""
    if value is None or isinstance(value, (bool, int)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, str):
        if value.startswith(("/", "~", "file://")):
            return "<redacted>"
        return value[:256]
    return None


def _manifest_event_record(event: dict) -> dict:
    """Select only bounded, scalar event identity and decision provenance."""
    provenance = event.get("provenance") or {}
    decision = provenance.get("decision") or {}
    return {
        key: _manifest_scalar(event.get(key))
        for key in (
            "event_id", "frame_index", "track_id", "direction", "status",
            "recovery", "detection_conf",
        )
    } | {
        "provenance": {
            key: _manifest_scalar(decision.get(key))
            for key in (
                "raw_conf", "dedup_hit", "cooldown_hit", "exclusion_hit",
                "recovered", "reason",
            )
        },
    }


def build_run_manifest(*, run_id: str, created_at: str, result: lab_core.LabResult,
                       config: dict, model_identifier: str, model_sha256: str | None,
                       model_size_bytes: int | None, input_filename: str | None,
                       input_sha256: str | None, video_id: str, video_url: str) -> dict:
    """Build the reproducibility record from actual inference inputs/outputs."""
    safe_config = _redact_config(config, model_identifier=model_identifier)
    events = result.events or []
    manifest = {
        "schema_version": RUN_SCHEMA_VERSION,
        "run_id": run_id,
        "created_at": created_at,
        "source": "lab",
        "input": {
            "filename": Path(input_filename).name if input_filename else None,
            "sha256": input_sha256,
            "video_width": result.video_width,
            "video_height": result.video_height,
            "fps": result.fps,
            "frame_count": result.frame_count,
            "frame_start": config.get("frame_start", 0),
            "frame_end": config.get("frame_end", 0),
            "frame_stride": config.get("frame_stride", 1),
        },
        "model": {
            "identifier": model_identifier,
            "sha256": model_sha256,
            "size_bytes": model_size_bytes,
        },
        "config": safe_config,
        "counts": {
            "summary": result.summary,
            "events": {
                "count": len(events),
                "event_ids": [event.get("event_id") for event in events],
                "event_records": [
                    _manifest_event_record(event)
                    for event in events[:MAX_MANIFEST_EVENT_RECORDS]
                    if isinstance(event, dict)
                ],
                "provenance_fields": sorted({key for event in events for key in (event.get("provenance") or {})}),
            },
        },
        "detection_diagnostics": result.detection_diagnostics,
        "output": {"video_id": video_id, "video_url": video_url},
    }
    return manifest


def _resolve_legacy_model_path(path: str) -> str:
    """Resolve a legacy model ID, rejecting traversal and outside absolute paths."""
    if not isinstance(path, str) or not path.strip():
        raise HTTPException(status_code=422, detail="model_path must be a non-empty .pt model path")
    root = lab_core.MODELS_DIR.resolve()
    raw = Path(path).expanduser()
    candidate = raw.resolve() if raw.is_absolute() else (root / raw).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="model_path must resolve inside the Lab models directory") from exc
    if candidate.suffix.lower() != ".pt":
        raise HTTPException(status_code=422, detail="model_path must point to a .pt model")
    return str(candidate)


def _new_job() -> dict:
    """Reserve a bounded process-local job record."""
    with _JOB_LOCK:
        terminal = [job_id for job_id, job in _JOB_STORE.items()
                    if job["status"] in {"succeeded", "failed"}]
        while len(_JOB_STORE) >= MAX_JOB_STORE and terminal:
            _JOB_STORE.pop(terminal.pop(0), None)
        if len(_JOB_STORE) >= MAX_JOB_STORE:
            raise HTTPException(status_code=429, detail="inference job queue is full")
        job = {
            "job_id": uuid.uuid4().hex,
            "status": "queued",
            "progress": 0.0,
            "processed_frames": 0,
            "total_frames": None,
            "message": "queued",
            "result": None,
        }
        _JOB_STORE[job["job_id"]] = job
        return job


def _update_job_progress(job_id: str, progress: float, message: str | None = None) -> None:
    with _JOB_LOCK:
        job = _JOB_STORE.get(job_id)
        if job is None:
            return
        match = re.search(r"frame\s+(\d+)\s*/\s*(\d+)", message or "", re.IGNORECASE)
        if match:
            job["processed_frames"] = max(0, int(match.group(1)))
            job["total_frames"] = max(0, int(match.group(2)))
        job["status"] = "running"
        job["progress"] = max(0.0, min(1.0, float(progress)))
        if message:
            job["message"] = message


def _finish_job(job_id: str, *, status: str, message: str | None = None,
                result: dict | None = None, processed_frames: int | None = None,
                total_frames: int | None = None) -> None:
    with _JOB_LOCK:
        job = _JOB_STORE.get(job_id)
        if job is None:
            return
        job["status"] = status
        job["progress"] = 1.0 if status == "succeeded" else job["progress"]
        if processed_frames is not None:
            job["processed_frames"] = processed_frames
        if total_frames is not None:
            job["total_frames"] = total_frames
        job["message"] = message or ("completed" if status == "succeeded" else status)
        job["result"] = result if status == "succeeded" else None


def _job_status_payload(job: dict) -> dict:
    with _JOB_LOCK:
        current = _JOB_STORE.get(job["job_id"], job)
        payload = {
            "job_id": current["job_id"],
            "status": current["status"],
            "progress": max(0.0, min(1.0, float(current["progress"]))),
            "processed_frames": current["processed_frames"],
            "total_frames": current["total_frames"],
            "message": current["message"],
        }
        if current["status"] == "succeeded":
            payload["result"] = current["result"]
        return payload


def _parse_config(config: str) -> lab_core.LabConfig:
    try:
        cfg_dict = json.loads(config or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"invalid JSON config: {exc.msg}") from exc
    if not isinstance(cfg_dict, dict):
        raise HTTPException(status_code=422, detail="config must be a JSON object")
    base = asdict(lab_core.LabConfig())
    base.update({k: v for k, v in cfg_dict.items() if k in base})
    if isinstance(base.get("classes"), list):
        base["classes"] = tuple(base["classes"])
    try:
        line_value = base.get("line")
        base["line"] = _normalize_line(line_value)
        if isinstance(line_value, dict):
            base["inflip"] = line_value["inflip"]
        return lab_core.LabConfig(**base)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"invalid config: {exc}") from exc


async def _prepare_inference(video: UploadFile, config: str, model: UploadFile | None):
    suffix = Path(video.filename or "in.mp4").suffix or ".mp4"
    in_path: str | None = None
    model_path: str | None = None
    try:
        in_path, _, input_sha256 = await _persist_upload(
            video, suffix=suffix, max_bytes=MAX_VIDEO_UPLOAD_BYTES, label="video", hash_upload=True
        )
        model_metadata: dict[str, object] = {}
        if model is not None:
            model_filename = Path(model.filename or "").name
            if Path(model_filename).suffix.lower() != ".pt":
                raise HTTPException(status_code=422, detail="model upload must be a .pt file")
            if model.content_type and model.content_type.lower() not in _MODEL_CONTENT_TYPES:
                raise HTTPException(status_code=422, detail=f"unsupported model content type: {model.content_type}")
            model_path, model_size, model_sha256 = await _persist_upload(
                model, suffix=".pt", max_bytes=MAX_MODEL_UPLOAD_BYTES, label="model", hash_upload=True
            )
            model_metadata = {"model_filename": model_filename, "model_sha256": model_sha256,
                              "model_size_bytes": model_size}
        cfg = _parse_config(config)
        if model_path is not None:
            cfg.model_path = model_path
            try:
                lab_core.load_model(model_path)
            except Exception as exc:
                raise HTTPException(status_code=422, detail="uploaded model could not be loaded") from exc
        else:
            cfg.model_path = _resolve_legacy_model_path(cfg.model_path)
            model_metadata = {"model_identifier": _model_id(cfg.model_path),
                              "model_sha256": _sha256_file(cfg.model_path),
                              "model_size_bytes": Path(cfg.model_path).stat().st_size if Path(cfg.model_path).is_file() else None}
        return in_path, model_path, input_sha256, model_metadata, cfg
    except Exception:
        if in_path is not None:
            Path(in_path).unlink(missing_ok=True)
        if model_path is not None:
            Path(model_path).unlink(missing_ok=True)
        raise


def _store_result(result: lab_core.LabResult, *, cfg: lab_core.LabConfig,
                  model_metadata: dict, input_filename: str | None,
                  input_sha256: str | None, task_id: str | None = None) -> dict:
    vid = uuid.uuid4().hex
    _VIDEO_STORE[vid] = result.output_video
    run_id = uuid.uuid4().hex
    created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    model_identifier = str(model_metadata.get("model_identifier") or model_metadata.get("model_filename") or "uploaded-model")
    manifest = build_run_manifest(
        run_id=run_id, created_at=created_at, result=result, config=asdict(cfg),
        model_identifier=model_identifier,
        model_sha256=model_metadata.get("model_sha256") if isinstance(model_metadata.get("model_sha256"), str) else None,
        model_size_bytes=model_metadata.get("model_size_bytes") if isinstance(model_metadata.get("model_size_bytes"), int) else None,
        input_filename=input_filename, input_sha256=input_sha256, video_id=vid,
        video_url=f"/api/lab/video/{vid}")
    _RUN_HISTORY[run_id] = manifest
    while len(_RUN_HISTORY) > MAX_RUN_HISTORY:
        del _RUN_HISTORY[next(iter(_RUN_HISTORY))]
    payload = asdict(result)
    payload.pop("output_video", None)
    payload.update({"config": manifest["config"], "video_id": vid,
                    "video_url": f"/api/lab/video/{vid}", "run_id": run_id,
                    "schema_version": RUN_SCHEMA_VERSION, "manifest": manifest})
    payload.update({key: value for key, value in model_metadata.items() if key != "model_filename"})
    _associate_run(task_id, run_id)
    return payload


@app.get("/api/lab/health")
def health():
    return {
        "ok": True,
        "service": "lab",
        "device_default": "mps",
        "capabilities": {
            "tracker": True,
            "healer": False,
            "scorer": True,
            "optical_flow": False,
        },
        "capability_details": _CAPABILITY_DETAILS,
    }


@app.post("/api/lab/tasks", status_code=201)
def create_task(payload: dict):
    values = _validate_task_payload(payload)
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    task_id = str(uuid.uuid4())
    row = {
        "task_id": task_id, "name": values["name"], "description": values.get("description", ""),
        "status": values.get("status", "draft"), "config": values.get("config", {}),
        "source": values.get("source", {}), "model": values.get("model", {}),
        "run_ids": values.get("run_ids", []), "latest_run_id": values.get("latest_run_id"),
    }
    with _task_connection() as connection:
        connection.execute("""INSERT INTO lab_tasks
            (task_id, name, description, status, config_json, source_json, model_json,
             run_ids_json, latest_run_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", (
                task_id, row["name"], row["description"], row["status"], _task_json(row["config"]),
                _task_json(row["source"]), _task_json(row["model"]), _task_json(row["run_ids"]),
                row["latest_run_id"], now, now))
        connection.commit()
    return _get_task(task_id)


@app.get("/api/lab/tasks")
def list_tasks():
    with _task_connection() as connection:
        rows = connection.execute("SELECT * FROM lab_tasks ORDER BY updated_at DESC, created_at DESC").fetchall()
    return {"tasks": [_task_from_row(row) for row in rows]}


@app.get("/api/lab/tasks/{task_id}")
def get_task(task_id: str):
    return _get_task(task_id)


@app.patch("/api/lab/tasks/{task_id}")
def update_task(task_id: str, payload: dict):
    current = _get_task(task_id)
    values = _validate_task_payload(payload, partial=True)
    if not values:
        raise HTTPException(status_code=422, detail="task patch must not be empty")
    merged = {**current, **values}
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    with _task_connection() as connection:
        connection.execute("""UPDATE lab_tasks SET name = ?, description = ?, status = ?,
            config_json = ?, source_json = ?, model_json = ?, run_ids_json = ?,
            latest_run_id = ?, updated_at = ? WHERE task_id = ?""", (
                merged["name"], merged["description"], merged["status"], _task_json(merged["config"]),
                _task_json(merged["source"]), _task_json(merged["model"]), _task_json(merged["run_ids"]),
                merged["latest_run_id"], now, task_id))
        connection.commit()
    return _get_task(task_id)


@app.get("/api/lab/models")
def models():
    model_ids = [_model_id(path) for path in lab_core.list_models()]
    defaults = asdict(lab_core.LabConfig())
    defaults["model_path"] = _model_id(defaults["model_path"])
    return {"models": model_ids, "default": _model_id(lab_core.DEFAULT_PT), "defaults": defaults}


@app.post("/api/lab/infer")
async def infer(
    video: UploadFile = File(...),
    config: str = Form("{}"),
    task_id: str | None = Form(None),
    model: UploadFile | None = File(None),
):
    """Run Lab inference using the legacy configured model or an uploaded .pt."""
    in_path = model_path = None
    try:
        in_path, model_path, input_sha256, model_metadata, cfg = await _prepare_inference(video, config, model)
        try:
            result = lab_core.run_inference(in_path, cfg)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"invalid config: {exc}") from exc
        return JSONResponse(_store_result(result, cfg=cfg, model_metadata=model_metadata,
                                           input_filename=video.filename, input_sha256=input_sha256,
                                           task_id=task_id))
    finally:
        if in_path is not None:
            Path(in_path).unlink(missing_ok=True)
        if model_path is not None:
            Path(model_path).unlink(missing_ok=True)


def _run_job(job_id: str, *, in_path: str, model_path: str | None,
             cfg: lab_core.LabConfig, model_metadata: dict,
             input_filename: str | None, input_sha256: str | None,
             task_id: str | None) -> None:
    _update_job_progress(job_id, 0.0, "running")
    try:
        result = lab_core.run_inference(in_path, cfg, progress=lambda p, msg: _update_job_progress(job_id, p, msg))
        payload = _store_result(result, cfg=cfg, model_metadata=model_metadata,
                                input_filename=input_filename, input_sha256=input_sha256,
                                task_id=task_id)
        _finish_job(job_id, status="succeeded", result=payload,
                    processed_frames=result.frames_processed, total_frames=result.frames_total)
    except Exception as exc:
        _finish_job(job_id, status="failed", message=str(exc) or exc.__class__.__name__)
    finally:
        Path(in_path).unlink(missing_ok=True)
        if model_path is not None:
            Path(model_path).unlink(missing_ok=True)


@app.post("/api/lab/infer/jobs", status_code=202)
async def infer_job(
    video: UploadFile = File(...),
    config: str = Form("{}"),
    task_id: str | None = Form(None),
    model: UploadFile | None = File(None),
):
    """Queue inference and return a process-local polling handle."""
    job = _new_job()
    try:
        in_path, model_path, input_sha256, model_metadata, cfg = await _prepare_inference(video, config, model)
    except Exception:
        with _JOB_LOCK:
            _JOB_STORE.pop(job["job_id"], None)
        raise
    import asyncio
    asyncio.create_task(asyncio.to_thread(
        _run_job, job["job_id"], in_path=in_path, model_path=model_path,
        cfg=cfg, model_metadata=model_metadata, input_filename=video.filename,
        input_sha256=input_sha256, task_id=task_id))
    return _job_status_payload(job)


@app.get("/api/lab/jobs/{job_id}")
def get_job(job_id: str):
    with _JOB_LOCK:
        job = _JOB_STORE.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return _job_status_payload(job)


@app.get("/api/lab/video/{video_id}")
def get_video(video_id: str):
    path = _VIDEO_STORE.get(video_id)
    if not path or not Path(path).exists():
        return JSONResponse({"error": "not found"}, status_code=404)
    return FileResponse(path, media_type="video/mp4")


@app.get("/api/lab/runs")
def runs(task_id: str | None = None):
    """List process-local manifests, optionally scoped to a durable LabTask."""
    manifests = list(reversed(list(_RUN_HISTORY.values())))
    if task_id:
        task = _get_task(task_id)
        allowed = set(task["run_ids"])
        manifests = [manifest for manifest in manifests if manifest.get("run_id") in allowed]
    return {"schema_version": RUN_SCHEMA_VERSION, "persistent": False,
            "task_id": task_id, "runs": manifests}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8077)
