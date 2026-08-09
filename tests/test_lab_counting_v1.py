import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "webui"))

from lab_core import (  # noqa: E402
    CentroidTracker,
    derive_crossing_event,
    side_of_line,
    summarize_events,
)


def test_side_of_line_and_inflip_direction():
    line = (10, 0, 10, 20)
    assert side_of_line((5, 10), line) > 0
    assert side_of_line((15, 10), line) < 0
    event = derive_crossing_event(
        previous_side=-1,
        current_side=1,
        inflip=False,
        frame_index=4,
        timestamp_ms=160,
        track_id=2,
        detection={"class_id": 1, "confidence": 0.9, "centroid": (15, 10), "bbox": [10, 5, 20, 15]},
        exclusion_zone=None,
        conf_split=0.6,
        sequence=1,
    )
    assert event["direction"] == "in"
    assert derive_crossing_event(**{
        "previous_side": -1, "current_side": 1, "inflip": True,
        "frame_index": 4, "timestamp_ms": 160, "track_id": 2,
        "detection": {"class_id": 1, "confidence": 0.9, "centroid": (15, 10), "bbox": [10, 5, 20, 15]},
        "exclusion_zone": None, "conf_split": 0.6, "sequence": 1,
    })["direction"] == "out"


def test_event_status_confidence_and_exclusion():
    base = {"class_id": 1, "confidence": 0.6, "centroid": (15, 10), "bbox": [10, 5, 20, 15]}
    assert derive_crossing_event(-1, 1, False, 2, 80, 1, base, None, 0.6, 1)["status"] == "confirmed"
    assert derive_crossing_event(-1, 1, False, 2, 80, 1, {**base, "confidence": 0.59}, None, 0.6, 1)["status"] == "flagged"
    excluded = {"zone_id": "door", "enabled": True}
    assert derive_crossing_event(-1, 1, False, 2, 80, 1, base, excluded, 0.6, 1)["status"] == "excluded"


def test_tracker_dedup_and_summary_invariants():
    tracker = CentroidTracker(track_buffer=2, match_distance_px=10, cooldown_frames=3)
    detections = [
        (0, [{"class_id": 1, "confidence": 0.8, "centroid": (5, 10), "bbox": [0, 0, 10, 20]}]),
        (1, [{"class_id": 1, "confidence": 0.8, "centroid": (15, 10), "bbox": [10, 0, 20, 20]}]),
        (2, [{"class_id": 1, "confidence": 0.8, "centroid": (5, 10), "bbox": [0, 0, 10, 20]}]),
        (3, [{"class_id": 1, "confidence": 0.8, "centroid": (15, 10), "bbox": [10, 0, 20, 20]}]),
    ]
    events = []
    for frame, dets in detections:
        events.extend(tracker.update(frame, dets, (10, 0, 10, 20), False, 0.6, 25))
    assert len(events) == 1
    assert events[0]["track_id"] == 1
    assert events[0]["status"] == "confirmed"
    summary = summarize_events(events)
    assert summary == {"total": 1, "total_crossings": 1, "confirmed": 1, "flagged": 0, "dropped": 0, "excluded": 0, "recovered": 0}


def test_tracker_expires_tracks_after_buffer():
    tracker = CentroidTracker(track_buffer=1, match_distance_px=5, cooldown_frames=0)
    tracker.update(0, [{"class_id": 1, "confidence": 0.8, "centroid": (0, 0), "bbox": [0, 0, 1, 1]}], None, False, 0.6, 25)
    tracker.update(2, [{"class_id": 1, "confidence": 0.8, "centroid": (100, 0), "bbox": [99, 0, 101, 1]}], None, False, 0.6, 25)
    assert tracker.active_track_ids == [2]
