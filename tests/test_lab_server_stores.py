"""The in-process stores must be bounded, and eviction must take the file with it.

`_JOB_STORE` and `_RUN_HISTORY` were both capped. `_VIDEO_STORE` was not, and every
replay adds one entry pointing at a NamedTemporaryFile(delete=False) mp4 — the input
video and the uploaded model are cleaned up in the endpoints' finally blocks, the
output never was. So a long session grew the dict and the disk together.

    pytest tests/test_lab_server_stores.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
for extra in (ROOT / "apps" / "api", ROOT / "webui"):
    if str(extra) not in sys.path:
        sys.path.insert(0, str(extra))

import lab_server  # noqa: E402


@pytest.fixture(autouse=True)
def clean_store():
    lab_server._VIDEO_STORE.clear()
    yield
    lab_server._VIDEO_STORE.clear()


def test_the_video_store_is_bounded():
    for i in range(lab_server.MAX_VIDEO_STORE + 25):
        lab_server._VIDEO_STORE[f"v{i}"] = f"/tmp/never-created-{i}.mp4"
    lab_server._evict_videos()
    assert len(lab_server._VIDEO_STORE) == lab_server.MAX_VIDEO_STORE


def test_it_evicts_the_oldest_and_keeps_the_newest():
    for i in range(lab_server.MAX_VIDEO_STORE + 5):
        lab_server._VIDEO_STORE[f"v{i}"] = f"/tmp/never-created-{i}.mp4"
    lab_server._evict_videos()
    assert "v0" not in lab_server._VIDEO_STORE
    assert f"v{lab_server.MAX_VIDEO_STORE + 4}" in lab_server._VIDEO_STORE


def test_eviction_deletes_the_file_it_was_pointing_at(tmp_path):
    victim = tmp_path / "evicted.mp4"
    victim.write_bytes(b"not really an mp4")
    lab_server._VIDEO_STORE["oldest"] = str(victim)
    for i in range(lab_server.MAX_VIDEO_STORE):
        lab_server._VIDEO_STORE[f"v{i}"] = str(tmp_path / f"kept-{i}.mp4")

    lab_server._evict_videos()

    assert "oldest" not in lab_server._VIDEO_STORE
    assert not victim.exists(), "the entry went but the file stayed — that is the disk leak"


def test_a_missing_file_does_not_break_eviction():
    """Best-effort on purpose: a video being streamed can fail to unlink on some
    platforms, and losing a temp file matters less than serving the request."""
    for i in range(lab_server.MAX_VIDEO_STORE + 3):
        lab_server._VIDEO_STORE[f"v{i}"] = f"/tmp/definitely-not-here-{i}.mp4"
    lab_server._evict_videos()  # must not raise
    assert len(lab_server._VIDEO_STORE) == lab_server.MAX_VIDEO_STORE


def test_under_the_cap_nothing_is_evicted(tmp_path):
    keep = tmp_path / "keep.mp4"
    keep.write_bytes(b"x")
    lab_server._VIDEO_STORE["only"] = str(keep)
    lab_server._evict_videos()
    assert lab_server._VIDEO_STORE == {"only": str(keep)}
    assert keep.exists()
