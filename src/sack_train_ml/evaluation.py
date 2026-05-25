"""Metric normalization and gate-check scaffold.

Planned responsibilities:
- normalize fp32 metrics
- normalize Hailo int8 metrics
- compare deltas
- emit gate verdicts for release metadata
"""

from __future__ import annotations


def normalize_metrics(raw: dict) -> dict:
    raise NotImplementedError("metric normalization not implemented yet")
