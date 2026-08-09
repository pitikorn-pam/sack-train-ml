import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "webui"))

from lab_core import CentroidTracker  # noqa: E402
from lab_path import PathPoint, TrackPath, predict, predictor_metadata  # noqa: E402


def point(frame, x, y, conf=0.9):
    return PathPoint(frame=frame, t_ms=frame * 40, cx=x, cy=y, conf=conf)


def test_track_path_is_bounded_and_tracks_life_displacement():
    path = TrackPath(track_id=4, class_id=1, hist_len=3)
    for frame, x in enumerate((0, 3, 6, 9), start=1):
        path.append(point(frame, x, 2))

    assert path.born_frame == 1
    assert path.last_frame == 4
    assert path.alive is True
    assert [p.frame for p in path.points] == [2, 3, 4]
    assert path.total_displacement == 9.0


def test_predictors_share_track_path_and_quadratic_follows_curve():
    path = TrackPath(track_id=2, class_id=1, hist_len=8)
    for frame, x in enumerate((0, 1, 4, 9), start=0):
        path.append(point(frame, x, 2))

    assert predict(path, 1, "linear") == (12.0, 2.0)
    quadratic = predict(path, 1, "quadratic")
    assert abs(quadratic[0] - 16.0) < 1e-9
    assert quadratic[1] == 2.0
    metadata = predictor_metadata(path, "quadratic")
    assert metadata["requested"] == "quadratic"
    assert metadata["supported"] is True
    assert metadata["points_used"] == 4


def test_optical_flow_is_explicitly_unsupported():
    path = TrackPath(track_id=2, class_id=1)
    path.append(point(0, 1, 2))

    metadata = predictor_metadata(path, "optical-flow")
    assert metadata["requested"] == "optical-flow"
    assert metadata["supported"] is False
    assert metadata["status"] == "unsupported"
    try:
        predict(path, 1, "optical-flow")
    except NotImplementedError as exc:
        assert "optical-flow" in str(exc)
    else:
        raise AssertionError("optical-flow must not silently fall back")


def test_tracker_attaches_path_slice_and_predictor_provenance():
    tracker = CentroidTracker(track_buffer=2, match_distance_px=20, cooldown_frames=0)
    tracker.update(0, [{"class_id": 1, "confidence": 0.8, "centroid": (5, 10), "bbox": [0, 0, 10, 20]}], (10, 0, 10, 20), False, 0.6, 0)
    events = tracker.update(1, [{"class_id": 1, "confidence": 0.8, "centroid": (15, 10), "bbox": [10, 0, 20, 20]}], (10, 0, 10, 20), False, 0.6, 40)

    assert len(events) == 1
    provenance = events[0]["provenance"]
    assert provenance["path"]["points"][-1]["frame"] == 1
    assert provenance["path"]["predictor"]["requested"] == "quadratic"
    assert provenance["path"]["total_displacement"] == 10.0
