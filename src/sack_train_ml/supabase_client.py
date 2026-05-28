"""Supabase RegistryClient — the only thing Python talks to on Supabase.

Responsibilities:
    - pull ``RunConfig`` from a runs row
    - stream metrics into ``run_metrics`` via the training-callback edge fn
    - append structured log entries into ``runs.config_yaml.logs``
    - upload artifact bytes via the upload-artifact edge fn + R2 PUT
    - create ``versions`` rows when training succeeds
    - finalize the run (status='succeeded'|'failed')

Authentication:
    - REST queries use the service-role JWT (admin scope, bypasses RLS)
    - training-callback POSTs are HMAC-SHA256 signed (per Phase 1 design)

The Colab notebook constructs this client once at the top of the run, then
hands it to every pipeline tool.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from .contracts import ArtifactRecord, RunConfig, sha256_file


# ----------------------------------------------------------------------------
# UploadedArtifact — return shape of upload_artifact
# ----------------------------------------------------------------------------

@dataclass
class UploadedArtifact:
    kind: str
    r2_key: str
    size_bytes: int
    content_hash: str
    quantization: dict[str, Any] | None = None

    def to_record(self) -> ArtifactRecord:
        return ArtifactRecord(
            kind=self.kind,  # type: ignore[arg-type]
            key=self.r2_key,
            size_bytes=self.size_bytes,
            sha256=self.content_hash,
            quantization=self.quantization,
        )


# ----------------------------------------------------------------------------
# Errors
# ----------------------------------------------------------------------------

class RegistryError(RuntimeError):
    """Raised on any HTTP failure talking to Supabase / edge functions."""


# ----------------------------------------------------------------------------
# Main client
# ----------------------------------------------------------------------------

class RegistryClient:
    """Thin REST wrapper over Supabase + edge functions for the training pipeline."""

    def __init__(
        self,
        supabase_url: str | None = None,
        service_role_key: str | None = None,
        callback_secret: str | None = None,
    ):
        self.url = (supabase_url or os.environ["SUPABASE_URL"]).rstrip("/")
        self.key = service_role_key or os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        self.callback_secret = callback_secret or os.environ.get("TRAINING_CALLBACK_SECRET", "")
        self._headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }

    # ---- run -----------------------------------------------------------------

    def fetch_run(self, run_id: str) -> dict[str, Any]:
        """GET runs row by id."""
        rows = self._rest("GET", f"/rest/v1/runs?id=eq.{run_id}&select=*")
        if not rows:
            raise RegistryError(f"run not found: {run_id}")
        return rows[0]

    def load_run_config(self, run_id: str) -> tuple[RunConfig, dict[str, Any]]:
        """Fetch run + parse config_yaml into RunConfig. Returns (config, raw_run)."""
        run = self.fetch_run(run_id)
        config = RunConfig.from_dict(run.get("config_yaml") or {})
        return config, run

    def patch_run(self, run_id: str, patch: dict[str, Any]) -> None:
        self._rest("PATCH", f"/rest/v1/runs?id=eq.{run_id}", body=patch)

    def mark_running(self, run_id: str) -> None:
        self.patch_run(run_id, {
            "status": "running",
            "started_at": _now_iso(),
        })

    def finalize_run(self, run_id: str, status: str = "succeeded", error: str | None = None) -> None:
        """Call training-callback to set succeeded/failed (HMAC-signed)."""
        body: dict[str, Any] = {"type": status, "run_id": run_id}
        if status == "failed" and error:
            body["error"] = error
        self._call_callback(body)

    # ---- metrics + logs ------------------------------------------------------

    def log_metric(self, run_id: str, step: int, name: str, value: float, epoch: int | None = None) -> None:
        self._call_callback({
            "type": "metric",
            "run_id": run_id,
            "step": step,
            "epoch": epoch if epoch is not None else step,
            "name": name,
            "value": float(value),
        })

    def log_metrics(self, run_id: str, rows: list[dict[str, Any]]) -> None:
        """Bulk-friendly wrapper that just loops one-by-one (training-callback is per-event)."""
        for r in rows:
            self.log_metric(
                run_id,
                step=int(r["step"]),
                name=str(r["name"]),
                value=float(r["value"]),
                epoch=r.get("epoch"),
            )

    def log_step(self, run_id: str, step: int, phase: str, status: str, message: str) -> None:
        self._call_callback({
            "type": "log",
            "run_id": run_id,
            "step": step,
            "phase": phase,
            "status": status,
            "message": message,
        })

    # ---- artifacts -----------------------------------------------------------

    def upload_artifact(
        self,
        path: str | Path,
        kind: str,
        run_id: str,
        semver: str,
        content_type: str | None = None,
        quantization: dict[str, Any] | None = None,
    ) -> UploadedArtifact:
        """Call upload-artifact edge fn → PUT to R2 → return record."""
        path = Path(path)
        body = {"kind": kind, "run_id": run_id, "semver": semver}
        if content_type:
            body["content_type"] = content_type
        resp = self._call_edge("upload-artifact", body)
        upload_url = resp["upload_url"]
        r2_key = resp["r2_key"]

        sha, size = sha256_file(path)
        data = path.read_bytes()
        req = Request(upload_url, data=data, method="PUT")
        if content_type:
            req.add_header("Content-Type", content_type)
        else:
            req.add_header("Content-Type", "application/octet-stream")
        with urlopen(req) as r:
            if r.status not in (200, 201, 204):
                raise RegistryError(f"R2 PUT failed status={r.status}")

        return UploadedArtifact(
            kind=kind,
            r2_key=r2_key,
            size_bytes=size,
            content_hash=sha,
            quantization=quantization,
        )

    def download_dataset(self, r2_key: str) -> str:
        """Return a presigned R2 GET URL (15 min TTL) for a dataset object."""
        resp = self._call_edge("download-dataset", {"r2_key": r2_key})
        return resp["download_url"]

    # ---- versions ------------------------------------------------------------

    def create_version(
        self,
        run_id: str,
        model_line_id: str,
        semver: str,
        artifacts: dict[str, ArtifactRecord],
        metadata: dict[str, Any],
        size_bytes: int | None = None,
        content_hash: str | None = None,
    ) -> dict[str, Any]:
        """Insert a versions row. compat_signature is computed by the DB trigger."""
        body = {
            "run_id": run_id,
            "model_line_id": model_line_id,
            "semver": semver,
            "artifacts": {k: a.to_jsonb() for k, a in artifacts.items()},
            "metadata": metadata,
            "size_bytes": size_bytes,
            "content_hash": content_hash,
        }
        rows = self._rest("POST", "/rest/v1/versions?select=*",
                          body=body,
                          extra_headers={"Prefer": "return=representation"})
        if not rows:
            raise RegistryError("versions insert returned no rows")
        return rows[0]

    # ---- internals -----------------------------------------------------------

    def _rest(
        self,
        method: str,
        path: str,
        body: Any = None,
        extra_headers: dict[str, str] | None = None,
    ) -> Any:
        url = f"{self.url}{path}"
        data = json.dumps(body).encode() if body is not None else None
        headers = dict(self._headers)
        if extra_headers:
            headers.update(extra_headers)
        req = Request(url, data=data, method=method, headers=headers)
        try:
            with urlopen(req, timeout=30) as r:
                text = r.read().decode()
                if not text:
                    return None
                return json.loads(text)
        except HTTPError as e:
            try:
                detail = e.read().decode()
            except Exception:
                detail = str(e)
            raise RegistryError(f"{method} {path} -> {e.code}: {detail}") from None

    def _call_edge(self, name: str, body: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.url}/functions/v1/{name}"
        req = Request(
            url,
            data=json.dumps(body).encode(),
            method="POST",
            headers=self._headers,
        )
        try:
            with urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except HTTPError as e:
            try:
                detail = e.read().decode()
            except Exception:
                detail = str(e)
            raise RegistryError(f"edge fn {name} -> {e.code}: {detail}") from None

    def _call_callback(self, body: dict[str, Any]) -> None:
        raw = json.dumps(body, sort_keys=False, separators=(",", ":"))
        url = f"{self.url}/functions/v1/training-callback"
        headers = {
            "Content-Type": "application/json",
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
        }
        if self.callback_secret:
            sig = hmac.new(self.callback_secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
            headers["x-training-signature"] = f"sha256={sig}"
        req = Request(url, data=raw.encode(), method="POST", headers=headers)
        # Retry once on transient 5xx
        for attempt in (1, 2):
            try:
                with urlopen(req, timeout=15) as r:
                    r.read()
                return
            except HTTPError as e:
                if 500 <= e.code < 600 and attempt == 1:
                    time.sleep(0.5)
                    continue
                try:
                    detail = e.read().decode()
                except Exception:
                    detail = str(e)
                raise RegistryError(f"training-callback -> {e.code}: {detail}") from None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
