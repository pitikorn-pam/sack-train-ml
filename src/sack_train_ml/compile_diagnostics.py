"""Compile stage evidence and immutable local archives (stdlib only).

One child journals successful operations; after it exits the parent alone finalizes.
File presence never establishes a completed stage. Persistence receipts live outside
of the ZIP whose digest they reference. No SDK, environment or storage bootstrap.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import zipfile
from weakref import WeakKeyDictionary
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def digest(path: Path) -> dict[str, Any]:
    h = hashlib.sha256()
    size = 0
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
            size += len(chunk)
    return {'sha256': h.hexdigest(), 'size_bytes': size}


def sanitize(text: str, known_secrets: tuple[str, ...] | list[str] = ()) -> str:
    """Redact provided secrets and auth/signed URL forms, without reading env vars."""
    for secret in sorted((s for s in known_secrets if s), key=len, reverse=True):
        text = text.replace(secret, '[REDACTED]')
    text = re.sub(r'(https?://)[^/\s]+@', r'\1[REDACTED]@', text)
    # Signed URLs may carry arbitrary provider-specific fields: omit the whole query.
    text = re.sub(r'(https?://[^\s?\#]+)\?[^\s]+', r'\1?[REDACTED]', text)
    text = re.sub(r'(?im)(\b(?:authorization|proxy-authorization)\s*[:=]\s*)[^\r\n]+', r'\1[REDACTED]', text)
    text = re.sub(r'(?i)\bBearer\s+[^\s,;]+', 'Bearer [REDACTED]', text)
    text = re.sub(r'(?i)([\"\']?\b(?:[\w-]*(?:secret|token|password|api[_-]?key|access[_-]?key|credential)|signature)\b[\"\']?\s*[:=]\s*)[\"\']?[^\s,;\"\'}]+[\"\']?', r'\1[REDACTED]', text)
    # JWTs occasionally appear without a field name.
    return re.sub(r'\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b', '[REDACTED]', text)


def _clean(value: Any, known_secrets: tuple[str, ...] = ()) -> Any:
    if isinstance(value, dict):
        return {sanitize(str(k), known_secrets): _clean(v, known_secrets) for k, v in value.items()
                if not re.search(r'(?i)auth|secret|token|password|credential|api.?key|access.?key', str(k))}
    if isinstance(value, (list, tuple)):
        return [_clean(v, known_secrets) for v in value]
    return sanitize(value, known_secrets) if isinstance(value, str) else value


def _json(path: Path, value: Any) -> None:
    """Atomic updates in the same directory; no shared temp names."""
    temp = path.with_name(f'.{path.name}.{uuid4().hex}.tmp')
    try:
        with temp.open('x', encoding='utf-8') as f:
            json.dump(_clean(value), f, indent=2, sort_keys=True)
            f.write('\n')
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def unknown(reason: str) -> dict[str, Any]:
    return {'value': None, 'reason': reason}


@dataclass(frozen=True)
class Attempt:
    directory: Path
    attempt_id: str
    known_secrets: tuple[str, ...] = field(default=(), repr=False)


@dataclass(frozen=True)
class ReadyArchive:
    path: Path
    attempt_id: str
    sha256: str
    size_bytes: int


# Redaction context never appears in public artifact metadata or serialized records.
_archive_redactions: WeakKeyDictionary[ReadyArchive, tuple[str, ...]] = WeakKeyDictionary()


class CompileFailure(RuntimeError):
    def __init__(self, message: str, archive: ReadyArchive):
        self.archive = archive
        super().__init__(sanitize(f'{message}; retained diagnostics: {archive.path}'))


class RetentionError(RuntimeError):
    def __init__(self, message: str, attempt_dir: Path):
        self.attempt_dir = attempt_dir
        super().__init__(sanitize(f'{message}; retained attempt directory: {attempt_dir}'))


def begin(root: Path, *, run_id: str | None, semver: str | None,
          onnx: Path, requested: dict[str, Any], known_secrets: tuple[str, ...] = ()) -> Attempt:
    attempt_id = str(uuid4())
    directory = Path(root) / 'compile-attempts' / attempt_id
    directory.mkdir(parents=True, exist_ok=False)
    try:
        source = {'name': Path(onnx).name, **digest(Path(onnx)), 'reason': None}
    except OSError as exc:
        source = {'name': Path(onnx).name, 'sha256': None, 'size_bytes': None,
                  'reason': sanitize(str(exc))}
    manifest = {
        'schema_version': 1, 'attempt_id': attempt_id, 'run_id': run_id, 'semver': semver,
        'started_at': now(), 'finished_at': None, 'requested': requested,
        'source_onnx': source,
        'evidence_kind': requested.get('evidence_kind', 'compile_attempt'),
        'sdk': {'version': None, 'source': None,
                'reason': 'FIXTURE: no SDK version measured' if requested.get('evidence_kind') == 'FIXTURE'
                else 'child has not reported an installed SDK version'},
        'compiler': {'name': 'hailo_dataflow_compiler', 'version': None, 'source': None,
                     'reason': 'FIXTURE: no compiler version measured' if requested.get('evidence_kind') == 'FIXTURE'
                     else 'child has not reported an installed compiler version'},
        'sdk_internal_settings': unknown('not_reported: no supported API queried for SDK-adjusted settings'),
        'model_script': {'file': None, 'applied': False, 'reason': 'not generated'},
        'calibration': {'requested_count': requested.get('calib_n'), 'actual_count': None,
                        'selected': None, 'preprocessing': unknown('calibration not loaded')},
        'stages': {**{s: {'status': 'not_completed', 'file': None} for s in ['native', 'quantized', 'hef']},
                   'full_precision': {'status': 'not_used', 'reason': 'recipe has no distinct full-precision optimized stage'}},
        'outcome': {'status': 'in_progress', 'returncode': None},
        'persistence': {'status': 'not_attempted', 'reason': 'external receipt records persistence after finalization'},
    }
    manifest = _clean(manifest, known_secrets)
    _json(directory / 'manifest.json', manifest)
    return Attempt(directory, attempt_id, known_secrets)


class StageJournal:
    def __init__(self, directory: Path):
        self.directory = Path(directory)

    def _read(self) -> dict[str, Any]:
        m = json.loads((self.directory / 'manifest.json').read_text())
        if m['finished_at'] is not None:
            raise RuntimeError('attempt already finalized; stage journal is closed')
        return m

    def verify_source(self, onnx: Path, supplied_sha: str | None = None) -> dict[str, Any]:
        identity = digest(onnx)
        if supplied_sha is not None and supplied_sha.removeprefix("sha256:") != identity["sha256"]:
            raise ValueError("source ONNX hash mismatch")
        if identity["sha256"] != self._read()["source_onnx"]["sha256"]:
            raise ValueError("source ONNX bytes changed after attempt creation")
        return identity

    def inputs(self, *, sdk_version: str | None = None,
               sdk_version_source: str | None = None,
               compiler_version: str | None = None,
               compiler_version_source: str | None = None,
               detected: dict[str, Any] | None = None,
               supplied_options: dict[str, Any] | None = None,
               requested: dict[str, Any] | None = None) -> None:
        m = self._read()
        # Each measurement has its own provenance; one version never proves another.
        if sdk_version is not None or sdk_version_source is not None:
            m['sdk'] = {'version': sdk_version, 'source': sdk_version_source or 'caller_reported',
                        'reason': None if sdk_version else 'SDK client version unavailable at reported source'}
        if compiler_version is not None or compiler_version_source is not None:
            m['compiler'] = {'name': 'hailo_dataflow_compiler', 'version': compiler_version,
                             'source': compiler_version_source or 'caller_reported',
                             'reason': None if compiler_version else 'compiler distribution version unavailable at reported source'}
        if requested is not None:
            m['requested'].update(requested)
        if detected is not None:
            m['observed_model'] = detected
        if supplied_options is not None:
            m['supplied_options'] = supplied_options
        _json(self.directory / 'manifest.json', m)

    def script(self, text: str, *, applied: bool = False) -> None:
        m = self._read()
        path = self.directory / 'model.alls'
        path.write_text(text)
        m['model_script'] = {'file': path.name, **digest(path), 'applied': applied, 'reason': None}
        config = self.directory / 'nms_config.json'
        if config.is_file():
            m['nms_config'] = {'file': config.name, **digest(config)}
        _json(self.directory / 'manifest.json', m)

    def calibration(self, selected: list[dict[str, Any]], *, requested_count: int,
                    preprocessing: dict[str, Any]) -> None:
        m = self._read()
        m['calibration'] = {'requested_count': requested_count, 'actual_count': len(selected),
                            'selected': selected, 'preprocessing': preprocessing}
        path = self.directory / 'calibration.json'
        _json(path, m['calibration'])
        m['calibration_file'] = {'file': path.name, 'status': 'committed', **digest(path)}
        _json(self.directory / 'manifest.json', m)

    def saved(self, stage: Literal['native', 'quantized', 'hef'], path: Path) -> None:
        """Caller invokes ONLY after successful save_har/closed HEF write."""
        if stage not in ('native', 'quantized', 'hef'):
            raise ValueError(f'unsupported stage: {stage}')
        m = self._read()
        path = Path(path).resolve()
        if path.parent != self.directory.resolve():
            raise ValueError('stage artifact must be inside this isolated attempt')
        m['stages'][stage] = {'status': 'completed', 'file': path.name, **digest(path), 'saved_at': now()}
        _json(self.directory / 'manifest.json', m)


def attach(attempt_dir: Path) -> StageJournal:
    journal = StageJournal(attempt_dir)
    journal._read()
    return journal


def finalize(attempt: Attempt, *, returncode: int | None, stdout: str, stderr: str,
             error: str | None = None, known_secrets: tuple[str, ...] | list[str] = ()) -> ReadyArchive:
    """Parent calls after process exit, including launch/import failure.

    Validate recorded byte identities and ZIP CRCs before constructing ReadyArchive.
    On failure all original stage evidence remains in the isolated directory.
    """
    known_secrets = (*attempt.known_secrets, *known_secrets)
    directory = attempt.directory
    temp_zip = directory / '.compile-diagnostics.zip.tmp'
    destination = directory / 'compile-diagnostics.zip'
    try:
        if destination.exists():
            raise RuntimeError('archive already finalized; refusing overwrite')
        (directory / 'stdout.log').write_text(sanitize(stdout, known_secrets))
        (directory / 'stderr.log').write_text(sanitize(stderr, known_secrets))
        m = json.loads((directory / 'manifest.json').read_text())
        complete = all(m['stages'][s]['status'] == 'completed' for s in ['native', 'quantized', 'hef'])
        m['finished_at'] = now()
        m['outcome'] = {'status': 'succeeded' if returncode == 0 and complete and not error else 'partial',
                        'returncode': returncode, 'error': sanitize(error, known_secrets) if error else None}
        m['logs'] = {name: digest(directory / name) for name in ['stdout.log', 'stderr.log']}
        _json(directory / 'manifest.json', m)
        members = {'manifest.json', 'stdout.log', 'stderr.log'}
        for detail in [m['model_script'], m.get('nms_config', {}), *m['stages'].values()]:
            if detail.get('sha256'):
                path = directory / detail['file']
                if digest(path) != {k: detail[k] for k in ['sha256', 'size_bytes']}:
                    raise RuntimeError(f'recorded artifact bytes changed: {path.name}')
                if not path.name.endswith('.hef'):
                    members.add(path.name)
        calibration = directory / 'calibration.json'
        identity = m.get('calibration_file')
        if calibration.exists() and not identity:
            raise RuntimeError('uncommitted calibration member; raw evidence retained outside ZIP')
        if identity:
            if identity.get('file') != calibration.name or identity.get('status') != 'committed':
                raise RuntimeError('invalid calibration member identity')
            if not calibration.is_file() or digest(calibration) != {k: identity[k] for k in ['sha256', 'size_bytes']}:
                raise RuntimeError('committed calibration member missing or bytes changed')
            if json.loads(calibration.read_text()) != m['calibration']:
                raise RuntimeError('calibration member contradicts manifest')
            members.add(calibration.name)
        with zipfile.ZipFile(temp_zip, 'x', compression=zipfile.ZIP_DEFLATED) as z:
            for name in sorted(members):
                z.write(directory / name, name)
        with zipfile.ZipFile(temp_zip) as z:
            if z.testzip() is not None or set(z.namelist()) != members:
                raise RuntimeError('ZIP validation failed')
        identity = digest(temp_zip)
        temp_zip.rename(destination)
        ready = ReadyArchive(destination, attempt.attempt_id, **identity)
        _archive_redactions[ready] = tuple(known_secrets)
        return ready
    except Exception as exc:
        temp_zip.unlink(missing_ok=True)
        prefix = f'{error}; ' if error else ''
        prefix = sanitize(prefix, known_secrets)
        raise RetentionError(sanitize(f'{prefix}diagnostic retention failed: {exc}', known_secrets), directory) from exc


def record_persistence(archive: ReadyArchive, outcome: dict[str, Any]) -> None:
    """Record actual returned key/error externally; ZIP remains immutable."""
    _json(archive.path.parent / 'persistence.json', {
        **_clean(outcome, _archive_redactions.get(archive, ())),
        'recorded_at': now(), 'attempt_id': archive.attempt_id,
        'archive': {'file': archive.path.name, 'sha256': archive.sha256, 'size_bytes': archive.size_bytes},
    })
