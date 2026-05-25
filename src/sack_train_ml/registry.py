"""Future registry abstraction scaffold.

Phase 1 should remain file-based.
This module exists so the web app and scripts have a future seam for:
- local JSON index mode
- database-backed registry mode
"""

from __future__ import annotations


def list_releases() -> list[dict]:
    raise NotImplementedError("registry listing not implemented yet")
