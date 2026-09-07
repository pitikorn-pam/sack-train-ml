"""Behavioural tests for the real Lab inference loop.

These drive ``lab_core.run_inference`` end to end against a synthetic mp4 and a
stub detector, so wiring defects are observable without a trained model: which
knob reaches the tracker, which fields reach the result, which temp files
survive the encode.
"""
from __future__ import annotations

import sys
import tempfile
from dataclasses import asdict
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "webui"))

import lab_core  # noqa: E402

cv2 = pytest.importorskip("cv2")
np = pytest.importorskip("numpy")

WIDTH, HEIGHT, FRAMES = 320, 240, 85
LINE = (160, 0, 160, HEIGHT - 1)


def _far_apart_crossings() -> list[tuple[float, float]]:
    """One track crossing x=160 twice, 60 frames and ~140 px apart."""
    points = [(100.0 + 5 * f, 60.0) for f in range(25)]                  # crosses near f=13
    points += [(220.0, 60.0 + 4 * (f - 24)) for f in range(25, 60)]      # slides down to y=200
    points += [(220.0 - 5 * (f - 60), 200.0) for f in range(60, FRAMES)]  # crosses back near f=73
    return points


def _same_place_crossings() -> list[tuple[float, float]]:
    """One track crossing x=160 twice, 53 frames apart but only 10 px apart."""
    points = [(100.0 + 5 * f, 60.0) for f in range(25)]                  # crosses near f=13
    points += [(220.0, 60.0) for _ in range(25, 54)]                     # waits past the cooldown
    points += [(220.0 - 5 * (f - 53), 60.0) for f in range(54, FRAMES)]  # crosses back near f=66
    return points


class _StubDetector:
    """Emits one sack box per predict() call, following a fixed centroid path."""

    def __init__(self, centroids):
        self._centroids = list(centroids)
        self.calls = 0

    def predict(self, frame, **kwargs):
        cx, cy = self._centroids[min(self.calls, len(self._centroids) - 1)]
        self.calls += 1
        box = SimpleNamespace(cls=1, conf=0.9, xyxy=[(cx - 10, cy - 10, cx + 10, cy + 10)])
        return [SimpleNamespace(boxes=[box])]


@pytest.fixture()
def lab_video(tmp_path):
    path = tmp_path / "clip.mp4"
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 25.0, (WIDTH, HEIGHT))
    assert writer.isOpened()
    frame = np.zeros((HEIGHT, WIDTH, 3), dtype="uint8")
    for _ in range(FRAMES):
        writer.write(frame)
    writer.release()
    return path


@pytest.fixture()
def scratch_tmpdir(monkeypatch, tmp_path):
    """Redirect tempfile so intermediates created by a replay are countable."""
    scratch = tmp_path / "scratch"
    scratch.mkdir()
    monkeypatch.setattr(tempfile, "tempdir", str(scratch))
    return scratch


@pytest.fixture()
def replay(monkeypatch, lab_video):
    """Run one replay with a stub detector; returns the LabResult."""
    def run(centroids=None, **config):
        detector = _StubDetector(centroids or _far_apart_crossings())
        monkeypatch.setattr(lab_core, "load_model", lambda path: detector)
        # Defaults the caller may override — including with None, which is a real case:
        # a run with no line is detection-only and must not claim a count.
        opts = {"line": LINE, "frame_stride": 1, **config}
        cfg = lab_core.LabConfig(**opts)
        return lab_core.run_inference(str(lab_video), cfg)
    return run


def _frames(result) -> list[int]:
    return [event["frame_index"] for event in result.events]


# D-15 — count cooldown and ROI dedup are two knobs, both meaningful.

def test_count_cooldown_is_not_swallowed_by_the_roi_dedup_window(replay):
    short = replay(count_cooldown_frames=40)
    long_window = replay(count_cooldown_frames=100)

    # 60 frames separate the two crossings: 40 lets the second through, 100 does not.
    assert _frames(short) == [13, 73]
    assert _frames(long_window) == [13]


def test_roi_dedup_suppresses_a_repeat_crossing_in_the_same_place(replay):
    guarded = replay(_same_place_crossings(), count_cooldown_frames=40, roi_dedup_px=25)
    ungated = replay(_same_place_crossings(), count_cooldown_frames=40, roi_dedup_px=0)

    # 53 frames apart clears the 40-frame cooldown; only the ROI radius stops it.
    assert _frames(guarded) == [13]
    assert _frames(ungated) == [13, 66]


# D-18 — a dropped crossing is a decision the summary has to account for.

def test_fused_dropped_crossings_are_first_class_in_the_result(replay):
    result = replay(scorer_mode="fused", scorer_config={"logit_b0": -5.0})

    assert result.summary["dropped"] == 2
    assert result.dropped == 2
    assert result.confirmed == 0
    assert (result.confirmed + result.flagged + result.dropped
            + result.summary["excluded"]) == result.summary["total"]
    assert asdict(result)["dropped"] == 2


# D-19 — the run reports the scorer contract its verdicts were produced with.

def test_run_reports_the_scorer_mode_config_and_features_it_used(replay):
    result = replay(scorer_mode="fused", scorer_config={"logit_b0": -5.0})
    payload = asdict(result)

    assert payload["scorer_mode"] == "fused"
    assert payload["scorer_config"]["logit_b0"] == -5.0
    assert payload["scorer_config"]["conf_split"] == lab_core.LabConfig().conf_split
    assert payload["scorer_config"]["weights"]["detection_conf"] == 1.0
    # The backend feeds the scorer no features; an empty map says so truthfully.
    assert payload["scorer_features"] == {}
    # The run-level config is the one the per-event verdicts actually used.
    assert payload["scorer_config"] == result.events[0]["scorer"]["config"]


def test_detection_only_run_claims_no_scorer_output(replay):
    result = replay(line=None)

    assert result.scorer_mode == ""
    assert result.scorer_config == {}
    assert result.dropped is None


# D-24 — the CSV's side columns come from sides the tracker already knows.

def test_events_carry_the_side_columns_the_csv_export_declares(replay):
    result = replay()

    assert result.events
    for event in result.events:
        assert event["side_before"] in {"a", "b"}
        assert event["side_after"] in {"a", "b"}
        assert event["side_before"] != event["side_after"]
    assert [event["side_before"] for event in result.events] == ["b", "a"]


# D-29 / D-30 — the intermediate mp4 is scratch, and an encoder fault is not a config fault.

def test_replay_leaves_only_the_finished_overlay_behind(replay, scratch_tmpdir):
    result = replay()

    assert Path(result.output_video).is_file()
    assert [path.name for path in scratch_tmpdir.glob("*.mp4")] == [Path(result.output_video).name]


def test_encoder_failure_raises_encoding_error_and_still_removes_the_intermediate(
        replay, scratch_tmpdir, monkeypatch):
    monkeypatch.setattr(lab_core, "subprocess", SimpleNamespace(
        run=lambda *args, **kwargs: SimpleNamespace(returncode=1, stderr=b"Unknown encoder 'libx264'")))

    with pytest.raises(lab_core.EncodingError) as failure:
        replay()

    assert "ffmpeg encoding failed" in str(failure.value)
    assert "Unknown encoder" in str(failure.value)
    # Only the empty output stub survives; the raw intermediate is gone.
    leftovers = sorted(scratch_tmpdir.glob("*.mp4"))
    assert len(leftovers) == 1
    assert leftovers[0].stat().st_size == 0
