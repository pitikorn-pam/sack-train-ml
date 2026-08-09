import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "webui"))

from lab_core import derive_crossing_event, score_crossing  # noqa: E402


def _event(confidence=0.8, class_id=1):
    return derive_crossing_event(
        -1, 1, False, 2, 80, 7,
        {"class_id": class_id, "confidence": confidence,
         "centroid": (15, 10), "bbox": [10, 5, 20, 15]},
        None, 0.6, 1,
    )


def test_passthrough_parity_conf_split_and_never_drop():
    low = score_crossing(_event(0.59), mode="passthrough", conf_split=0.6)
    high = score_crossing(_event(0.60), mode="passthrough", conf_split=0.6)
    assert low["verdict"] == "flagged"
    assert high["verdict"] == "confirmed"
    assert low["score"] is None
    assert low["scorer"]["mode"] == "passthrough"
    assert low["scorer"]["config"]["conf_split"] == 0.6
    event = _event(0.59)
    assert event["score"] is None
    assert event["verdict"] == "flagged"
    assert event["scorer"]["mode"] == "passthrough"


def test_fused_score_has_confirmed_flagged_and_drop_bands():
    config = {"logit_b0": 0.0, "weights": {"detection_conf": 4.0},
              "threshold_confirmed": 0.65, "threshold_flagged": 0.45}
    confirmed = score_crossing(_event(), mode="fused", conf_split=0.6,
                               features={"detection_conf": 1.0}, scorer_config=config)
    flagged = score_crossing(_event(), mode="fused", conf_split=0.6,
                             features={"detection_conf": 0.5}, scorer_config=config)
    dropped = score_crossing(_event(), mode="fused", conf_split=0.6,
                             features={"detection_conf": 0.0}, scorer_config=config)
    assert confirmed["verdict"] == "confirmed"
    assert flagged["verdict"] == "flagged"
    assert dropped["verdict"] == "dropped"
    assert 0.0 <= dropped["score"] < 0.45


def test_fused_veto_requires_evidence_and_records_provenance():
    result = score_crossing(
        _event(), mode="fused", conf_split=0.6,
        features={"detection_conf": 1.0, "static_in_zone_phantom": True,
                   "static_in_zone_phantom_evidence": {"dwell_frames": 20}},
        scorer_config={"weights": {"detection_conf": 4.0}},
    )
    assert result["verdict"] == "dropped"
    assert result["score_breakdown"]["veto"] == "static_in_zone_phantom"
    assert result["feature_provenance"]["static_in_zone_phantom"]["dwell_frames"] == 20


def test_non_sack_veto_is_not_invented_without_class_evidence():
    result = score_crossing(_event(class_id=0), mode="fused", conf_split=0.6,
                            features={"detection_conf": 1.0})
    assert result["verdict"] == "confirmed"
    result = score_crossing(_event(class_id=0), mode="fused", conf_split=0.6,
                            features={"detection_conf": 1.0, "non_sack": True})
    assert result["verdict"] == "dropped"


def test_detection_only_has_no_score_fields():
    assert "score" not in {"frames_processed": 1, "events": []}
