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
import sys
import tempfile
import uuid
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
                "provenance_fields": sorted({key for event in events for key in (event.get("provenance") or {})}),
            },
        },
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


@app.get("/api/lab/health")
def health():
    return {
        "ok": True,
        "service": "lab",
        "device_default": "mps",
        "capabilities": {"tracker": True, "healer": False, "scorer": True},
    }


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
    model: UploadFile | None = File(None),
):
    """Run Lab inference using the legacy configured model or an uploaded .pt."""
    suffix = Path(video.filename or "in.mp4").suffix or ".mp4"
    in_path: str | None = None
    model_path: str | None = None
    model_metadata: dict[str, object] = {}
    input_sha256: str | None = None
    try:
        in_path, _, input_sha256 = await _persist_upload(
            video, suffix=suffix, max_bytes=MAX_VIDEO_UPLOAD_BYTES, label="video", hash_upload=True
        )

        if model is not None:
            model_filename = Path(model.filename or "").name
            if Path(model_filename).suffix.lower() != ".pt":
                raise HTTPException(status_code=422, detail="model upload must be a .pt file")
            if model.content_type and model.content_type.lower() not in _MODEL_CONTENT_TYPES:
                raise HTTPException(
                    status_code=422,
                    detail=f"unsupported model content type: {model.content_type}",
                )
            model_path, model_size, model_sha256 = await _persist_upload(
                model,
                suffix=".pt",
                max_bytes=MAX_MODEL_UPLOAD_BYTES,
                label="model",
                hash_upload=True,
            )
            model_metadata = {
                "model_filename": model_filename,
                "model_sha256": model_sha256,
                "model_size_bytes": model_size,
            }

        # merge posted config over defaults
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
            if "line" in base:
                line_value = base["line"]
                # Validate the canonical object before reading inflip so malformed
                # wire data becomes a client error rather than an uncaught KeyError.
                base["line"] = _normalize_line(line_value)
                if isinstance(line_value, dict):
                    base["inflip"] = line_value["inflip"]
            cfg = lab_core.LabConfig(**base)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=422, detail=f"invalid config: {exc}") from exc

        if model_path is not None:
            # The uploaded model always wins over legacy config.model_path.
            cfg.model_path = model_path
            try:
                lab_core.load_model(model_path)
            except Exception as exc:
                raise HTTPException(status_code=422, detail="uploaded model could not be loaded") from exc
        else:
            # Preserve the default and old absolute-path config shape, but only
            # after constraining both forms to MODELS_DIR.
            cfg.model_path = _resolve_legacy_model_path(cfg.model_path)
            model_metadata = {
                "model_identifier": _model_id(cfg.model_path),
                "model_sha256": _sha256_file(cfg.model_path),
                "model_size_bytes": Path(cfg.model_path).stat().st_size if Path(cfg.model_path).is_file() else None,
            }

        try:
            result = lab_core.run_inference(in_path, cfg)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"invalid config: {exc}") from exc
        vid = uuid.uuid4().hex
        _VIDEO_STORE[vid] = result.output_video
        run_id = uuid.uuid4().hex
        created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        model_identifier = str(model_metadata.get("model_identifier") or model_metadata.get("model_filename") or "uploaded-model")
        manifest_model_sha256 = model_metadata.get("model_sha256") if isinstance(model_metadata.get("model_sha256"), str) else None
        manifest_model_size = model_metadata.get("model_size_bytes") if isinstance(model_metadata.get("model_size_bytes"), int) else None
        manifest = build_run_manifest(
            run_id=run_id, created_at=created_at, result=result,
            config=asdict(cfg), model_identifier=model_identifier,
            model_sha256=manifest_model_sha256, model_size_bytes=manifest_model_size,
            input_filename=video.filename, input_sha256=input_sha256,
            video_id=vid, video_url=f"/api/lab/video/{vid}",
        )
        _RUN_HISTORY[run_id] = manifest
        while len(_RUN_HISTORY) > MAX_RUN_HISTORY:
            del _RUN_HISTORY[next(iter(_RUN_HISTORY))]
        payload = asdict(result)
        payload.pop("output_video", None)
        payload["config"] = manifest["config"]
        payload["video_id"] = vid
        payload["video_url"] = f"/api/lab/video/{vid}"
        payload["run_id"] = run_id
        payload["schema_version"] = RUN_SCHEMA_VERSION
        payload["manifest"] = manifest
        payload.update({key: value for key, value in model_metadata.items() if key != "model_filename"})
        return JSONResponse(payload)
    finally:
        if in_path is not None:
            Path(in_path).unlink(missing_ok=True)
        if model_path is not None:
            Path(model_path).unlink(missing_ok=True)


@app.get("/api/lab/video/{video_id}")
def get_video(video_id: str):
    path = _VIDEO_STORE.get(video_id)
    if not path or not Path(path).exists():
        return JSONResponse({"error": "not found"}, status_code=404)
    return FileResponse(path, media_type="video/mp4")


@app.get("/api/lab/runs")
def runs():
    """List manifests retained by this process; no durable history is claimed."""
    return {"schema_version": RUN_SCHEMA_VERSION, "persistent": False,
            "runs": list(reversed(list(_RUN_HISTORY.values())))}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8077)
