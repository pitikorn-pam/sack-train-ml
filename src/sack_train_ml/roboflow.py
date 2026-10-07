"""Colab-only Roboflow adapter. Credentials are explicit, ephemeral arguments."""
from __future__ import annotations

import json
import re
import stat
import tempfile
import time
import zipfile
from pathlib import Path, PurePosixPath
from typing import BinaryIO
from urllib.error import HTTPError
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

import yaml

MAX_BUNDLE = 512 * 1024 * 1024
MAX_YAML = 1024 * 1024
MAX_EXPORT_WAIT = 180
SUPPORTED_FORMATS = {"yolov8", "yolov11"}


def validate_source(value: object) -> dict:
    keys = {"kind", "workspace", "project", "version", "format"}
    if (not isinstance(value, dict) or set(value) != keys or value.get("kind") != "roboflow"
            or any(not isinstance(value.get(k), str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", value[k]) for k in ("workspace", "project"))
            or type(value.get("version")) is not int or not 1 <= value["version"] <= 2**53 - 1
            or not isinstance(value.get("format"), str) or value["format"] not in SUPPORTED_FORMATS):
        raise ValueError("Invalid Roboflow reference.")
    return {k: value[k] for k in ("kind", "workspace", "project", "version", "format")}


def _has_credentials(value: object) -> bool:
    if isinstance(value, dict):
        return any(re.fullmatch(r"api[_-]?key|roboflow[_-]?api[_-]?key|snippet|raw[_-]?snippet|token|password|secret|credentials", str(k), re.I)
                   or _has_credentials(v) for k, v in value.items())
    return isinstance(value, list) and any(_has_credentials(v) for v in value)


def _contains_secret(value: object, secret: str) -> bool:
    if isinstance(value, str):
        return secret in value
    if isinstance(value, dict):
        return any(_contains_secret(k, secret) or _contains_secret(v, secret) for k, v in value.items())
    return isinstance(value, (list, tuple, set)) and any(_contains_secret(v, secret) for v in value)


class _UniqueLoader(yaml.SafeLoader):
    pass


def _unique_mapping(loader, node):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node)
        if key in result:
            raise ValueError("Duplicate dataset YAML keys.")
        result[key] = loader.construct_object(value_node)
    return result


_UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _unique_mapping)


def load_yaml(text: str) -> dict:
    try:
        data = yaml.load(text, Loader=_UniqueLoader)
        if not isinstance(data, dict) or "download" in data or _has_credentials(data):
            raise ValueError
        return data
    except Exception:
        raise ValueError("Invalid or unsafe dataset YAML.") from None


def ordered_classes(data: dict) -> list[str]:
    names = data.get("names")
    if isinstance(names, dict):
        if not all(type(k) is int for k in names) or set(names) != set(range(len(names))):
            raise ValueError("Dataset class IDs must be contiguous integers starting at zero.")
        names = [names[k] for k in range(len(names))]
    if (not isinstance(names, list) or not names
            or not all(isinstance(n, str) and n.strip() and all(ord(c) >= 32 for c in n) for n in names)
            or len(set(names)) != len(names)
            or type(data.get("nc", len(names))) is not int or data.get("nc", len(names)) != len(names)):
        raise ValueError("Dataset YAML must have valid ordered names and matching nc.")
    return list(names)


def validate_url(url: str) -> None:
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError:
        raise ValueError("Roboflow returned an unsupported download host.") from None
    host = parsed.hostname or ""
    if (parsed.scheme != "https" or parsed.username or parsed.password
            or port not in (None, 443)
            or not (host == "roboflow.com" or host.endswith(".roboflow.com")
                    or host == "storage.googleapis.com")):
        raise ValueError("Roboflow returned an unsupported download host.")
    if host == "storage.googleapis.com" and _query_has_api_key(url):
        raise ValueError("Credential-bearing export URL refused.")


def _query_has_api_key(url: str) -> bool:
    return any(name.lower() == "api_key" for name, _ in parse_qsl(urlsplit(url).query, keep_blank_values=True))


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_OPENER = build_opener(_NoRedirect())


def _open(url: str, deadline: float):
    for _ in range(6):
        validate_url(url)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ValueError("Roboflow export timed out. Retry on Colab.")
        try:
            return _OPENER.open(Request(url, headers={"User-Agent": "sack-train-ml"}),
                                timeout=min(30, remaining))
        except HTTPError as error:
            location = error.headers.get("Location")
            code = error.code
            error.close()
            if code not in (301, 302, 303, 307, 308) or not location:
                raise ValueError("Roboflow could not export this dataset. Check access, version and API key.") from None
            next_url = urljoin(url, location)
            if urlsplit(next_url).hostname != urlsplit(url).hostname and _query_has_api_key(next_url):
                raise ValueError("Credential-bearing cross-host redirect refused.") from None
            url = next_url
    raise ValueError("Roboflow download redirected too many times.")


def validate_archive(bundle: BinaryIO, api_key: str, deadline: float | None = None) -> str:
    deadline = deadline if deadline is not None else time.monotonic() + MAX_EXPORT_WAIT
    secret = api_key.encode("utf-8")
    try:
        with zipfile.ZipFile(bundle) as zipped:
            entries = zipped.infolist()
            if len(entries) > 100_000 or sum(entry.file_size for entry in entries) > 4 * 1024**3:
                raise ValueError("Dataset exceeds the file-count or expanded-size limit.")
            seen = set()
            for entry in entries:
                path = PurePosixPath(entry.filename)
                if (path.is_absolute() or ".." in path.parts or "\\" in entry.filename
                        or ":" in entry.filename or entry.filename in seen
                        or stat.S_ISLNK(entry.external_attr >> 16) or entry.flag_bits & 1):
                    raise ValueError("Dataset ZIP contains unsafe or duplicate paths.")
                canonical = str(path)
                if canonical in seen:
                    raise ValueError("Dataset ZIP contains duplicate normalized paths.")
                seen.add(canonical)
                if api_key in entry.filename:
                    raise ValueError("Dataset ZIP contains credentials.")
                if not entry.is_dir():
                    tail = b""
                    with zipped.open(entry) as member:
                        while chunk := member.read(1024 * 1024):
                            if time.monotonic() >= deadline:
                                raise ValueError("Dataset validation timed out. Try a smaller dataset.")
                            content = tail + chunk
                            if secret in content:
                                raise ValueError("Dataset ZIP contains credentials.")
                            tail = content[-(len(secret) - 1):] if len(secret) > 1 else b""
            manifests = [entry for entry in entries if PurePosixPath(entry.filename).name in ("data.yaml", "data.yml")]
            if len(manifests) != 1 or len(PurePosixPath(manifests[0].filename).parts) > 2:
                raise ValueError("Dataset ZIP must have exactly one data.yaml at its root or in one folder.")
            manifest = manifests[0]
            if manifest.file_size > MAX_YAML:
                raise ValueError("Dataset YAML is too large.")
            text = zipped.read(manifest).decode("utf-8")
            data = load_yaml(text)
            if (not isinstance(data, dict) or "download" in data or api_key in text
                    or _has_credentials(data) or _contains_secret(data, api_key)):
                raise ValueError("Dataset YAML contains unsafe download instructions or credentials.")
            ordered_classes(data)
            for split in ("train", "val", "test"):
                value = data.get(split)
                if split == "test" and not value:
                    continue
                if not isinstance(value, str) or not value:
                    raise ValueError("Dataset YAML must include train and val image paths.")
                # Roboflow uses ../train/images even though train is inside the ZIP root.
                normalized = value.removeprefix("../").removeprefix("./")
                if (PurePosixPath(normalized).is_absolute() or ".." in PurePosixPath(normalized).parts
                        or ":" in normalized or "\\" in normalized):
                    raise ValueError("Dataset split paths must stay inside the dataset.")
                prefix = str(PurePosixPath(manifest.filename).parent / normalized).removeprefix("./").rstrip("/") + "/"
                if not any(entry.filename.startswith(prefix) and not entry.is_dir() for entry in entries):
                    raise ValueError("Dataset ZIP is missing images for a required split.")
            return text
    except (zipfile.BadZipFile, UnicodeError, yaml.YAMLError, RuntimeError):
        raise ValueError("Roboflow export is not a readable YOLO dataset ZIP.") from None
    finally:
        bundle.seek(0)


def prepare_dataset(source: object, api_key: str, destination: str | Path) -> Path:
    """Download on Colab; never called by the training entrypoint or local API.

    No secret enters the marker/YAML. All transport exceptions are suppressed,
    including their chained context; upstream URLs can contain the API key.
    """
    ref = validate_source(source)
    if not isinstance(api_key, str) or not api_key or len(api_key) > 512 or any(ord(c) < 33 for c in api_key):
        raise ValueError("Supply ROBOFLOW_API_KEY through Colab Secrets or hidden input.")
    if _contains_secret(ref, api_key):
        raise ValueError("Roboflow source metadata contains credentials.")
    dest = Path(destination).resolve()
    if dest.exists():
        raise ValueError("Prepared dataset destination already exists; use a fresh run directory.")
    try:
        deadline = time.monotonic() + MAX_EXPORT_WAIT
        api_url = (f"https://api.roboflow.com/{ref['workspace']}/{ref['project']}/"
                   f"{ref['version']}/{ref['format']}?{urlencode({'api_key': api_key})}")
        while True:
            with _open(api_url, deadline) as response:
                raw = response.read(MAX_YAML + 1)
                if len(raw) > MAX_YAML:
                    raise ValueError("Export response too large.")
                if response.status == 202:
                    if time.monotonic() + 2 >= deadline:
                        raise ValueError("Export timed out.")
                    time.sleep(2)
                    continue
                metadata = json.loads(raw)
                link = metadata['export']['link']
                if not isinstance(link, str):
                    raise ValueError("Invalid export link.")
                break
        with tempfile.TemporaryFile(mode='w+b') as bundle:
            with _open(link, deadline) as response:
                total = 0
                while chunk := response.read(1024 * 1024):
                    total += len(chunk)
                    if total > MAX_BUNDLE or time.monotonic() >= deadline:
                        raise ValueError("Dataset download exceeded limits.")
                    bundle.write(chunk)
            bundle.seek(0)
            text = validate_archive(bundle, api_key, deadline)
            data = load_yaml(text)
            data['names'] = ordered_classes(data)
            # Use a staging folder so failed validation/extraction cannot publish a marker.
            dest.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(dir=dest.parent) as staging:
                with zipfile.ZipFile(bundle) as zipped:
                    zipped.extractall(staging)  # all members checked before extraction
                manifests = [p for p in Path(staging).rglob('*') if p.name in ('data.yaml', 'data.yml')]
                root = manifests[0].parent
                for split in ('train', 'val', 'test'):
                    if data.get(split):
                        data[split] = data[split].removeprefix('../').removeprefix('./')
                data['path'] = str(dest)
                (root / 'data.yaml').write_text(yaml.safe_dump(data, sort_keys=False))
                (root / '.roboflow-source.json').write_text(json.dumps(ref, sort_keys=True))
                root.rename(dest)
        return dest
    except Exception:
        raise ValueError("Roboflow download failed. Check access, version and key on Colab; retry with a fresh directory.") from None


def resolve_prepared_config(raw: dict, dataset_dir: str | None) -> dict:
    """Resolve only a prepared directory bound to this exact non-secret source."""
    ref = validate_source(raw.get('dataset_source'))
    if _has_credentials(raw) or 'dataset' in raw or 'dataset_bundle' in raw:
        raise ValueError("Roboflow config contains forbidden credentials or manual dataset fields.")
    if not dataset_dir:
        raise ValueError("Roboflow requires the dataset directory prepared by the Colab notebook (--dataset-dir).")
    root = Path(dataset_dir).expanduser().resolve()
    try:
        marker = json.loads((root / '.roboflow-source.json').read_text())
        if validate_source(marker) != ref:
            raise ValueError
        data = load_yaml((root / 'data.yaml').read_text())
        names = ordered_classes(data)
        if 'classes' in raw and raw['classes'] != names:
            raise ValueError
        # Prevent manual overrides and YAML hooks/paths escaping the prepared tree.
        if data.get('path') != str(root):
            raise ValueError
        for split in ('train', 'val', 'test'):
            v = data.get(split)
            if split == 'test' and not v:
                continue
            if not isinstance(v, str) or not v or ':' in v or '\\' in v:
                raise ValueError
            path = (root / v).resolve()
            if not path.is_relative_to(root) or not path.is_dir():
                raise ValueError
    except Exception:
        raise ValueError("Prepared Roboflow directory does not match the selected source or has invalid YAML/classes.") from None
    return {**raw, 'dataset_source': ref, 'dataset': str(root / 'data.yaml'), 'classes': names}
