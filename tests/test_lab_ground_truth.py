import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "webui"))

from lab_core import LabConfig, summarize_events  # noqa: E402


def test_summary_compares_confirmed_events_to_explicit_ground_truth_with_tolerance():
    events = [
        {"status": "confirmed", "recovery": "none"},
        {"status": "confirmed", "recovery": "none"},
        {"status": "flagged", "recovery": "none"},
    ]

    summary = summarize_events(events, ground_truth=2, tolerance_pct=0.10)

    assert summary["total"] == 3
    assert summary["confirmed"] == 2
    assert summary["ground_truth"] == 2
    assert summary["error_vs_ground_truth"] == 0.0
    assert summary["within_tolerance"] is True
    assert summary["over_tolerance"] is False
    assert summary["under_tolerance"] is False


def test_summary_marks_under_and_over_tolerance_from_signed_error():
    under = summarize_events(
        [{"status": "confirmed", "recovery": "none"}] * 8,
        ground_truth=10,
        tolerance_pct=0.10,
    )
    over = summarize_events(
        [{"status": "confirmed", "recovery": "none"}] * 12,
        ground_truth=10,
        tolerance_pct=0.10,
    )

    assert under["error_vs_ground_truth"] == -0.2
    assert under["under_tolerance"] is True
    assert under["over_tolerance"] is False
    assert over["error_vs_ground_truth"] == 0.2
    assert over["over_tolerance"] is True
    assert over["under_tolerance"] is False


def test_ground_truth_is_optional_and_defaults_match_deployed_edge():
    config = LabConfig()
    assert config.ground_truth is None
    assert config.tolerance_pct is None
    assert config.conf == 0.25
    assert config.conf_split == 0.60
    assert config.roi_dedup_px == 25
    assert config.roi_dedup_frames == 120
    assert config.count_cooldown_frames == 40
    assert config.track_buffer == 30
    assert config.match_thresh == 0.70

    summary = summarize_events([], ground_truth=None)
    assert "ground_truth" not in summary
    assert "error_vs_ground_truth" not in summary
