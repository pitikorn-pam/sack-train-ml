"""The events CSV header and its rows must be the same width.

A CSV whose row is one cell longer than its header does not fail — it shifts every
column after the extra cell, and the file still opens, still parses, and is wrong in a
way that reads as plausible data. That is worse than a crash.

Three columns were structurally always empty and one of them, `path_corridor_distance`,
was emitted in the row while the backend never produced it. Removing them from the
header without the row would have produced exactly the silent shift above.

This parses the source, because both lists live inline in a 600-line component and
neither is exported. It is deliberately narrow: it counts, it does not interpret.

    pytest tests/test_events_csv.py
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

LAB_TSX = Path(__file__).resolve().parents[1] / "apps" / "web" / "src" / "sections" / "Lab.tsx"


@pytest.fixture(scope="module")
def source() -> str:
    return LAB_TSX.read_text()


def _header(source: str) -> list[str]:
    m = re.search(r"const columns = \[(.*?)\] as const;", source, re.S)
    assert m, "the events-CSV header array was not found"
    return re.findall(r'"([^"]+)"', m.group(1))


def _row_cell_count(source: str) -> int:
    m = re.search(r"result\.events\.map\(\(event\) => \[(.*?)\]\.map\(csvValue\)", source, re.S)
    assert m, "the events-CSV row array was not found"
    body = re.sub(r"//[^\n]*", "", m.group(1))
    # A trailing comma before the closing bracket is idiomatic here and is not a cell.
    body = body.rstrip().rstrip(",")

    cells, depth = 1, 0
    for ch in body:
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch == "," and depth == 0:
            cells += 1
    # `...(event.bbox ?? [a, b, c, d])` is one expression that yields four cells.
    spreads = len(re.findall(r"\.\.\.\(event\.bbox", body))
    return cells - spreads + spreads * 4


def test_header_and_row_are_the_same_width(source):
    header = _header(source)
    assert len(header) == _row_cell_count(source), (
        f"events CSV header has {len(header)} columns and the row emits "
        f"{_row_cell_count(source)} cells — every column after the mismatch is shifted"
    )


def test_no_column_the_backend_never_fills(source):
    """Each of these was emitted, always empty, and read as data."""
    header = _header(source)
    for dead in ("path_corridor_distance", "dedup_hit", "cooldown_hit"):
        assert dead not in header, f"{dead} is never populated and must not be a column"


def test_the_columns_that_do_carry_data_are_still_there(source):
    header = _header(source)
    for live in ("event_id", "frame_index", "track_id", "status", "detection_conf",
                 "side_before", "side_after", "exclusion_hit", "path_total_displacement"):
        assert live in header, f"{live} carries real data and was removed"
