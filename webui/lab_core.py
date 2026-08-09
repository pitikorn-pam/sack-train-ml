"""lab_core — reusable inference core for the Sack-Detector-Edge Lab.

V0 remains detection overlay + per-frame statistics. V1 adds a deterministic
nearest-centroid tracker and auditable sack line-crossing events when a valid
pixel line is configured; no line means confirmed/flagged/recovered stay null.

Pure Python helpers are kept importable without inference dependencies so the
counter can be tested against synthetic detections.
"""
from __future__ import annotations

import subprocess
import tempfile
from dataclasses import dataclass, field, asdict
import math
from pathlib import Path

from lab_path import PathPoint, TrackPath, predict, predictor_metadata

try:  # Keep pure counting helpers importable in lightweight test environments.
    import cv2
    import numpy as np
    from ultralytics import YOLO
except ModuleNotFoundError:  # pragma: no cover - inference-only dependency guard
    cv2 = None
    np = None
    YOLO = object

MODELS_DIR = Path("/Users/pitikorn/Work/BSCP/vdo_train/Models")
DEFAULT_PT = str(MODELS_DIR / "04-08-26-model_DET_11/1.0.0-b05c28ae.pt")
COLORS = {0: (255, 0, 255), 1: (0, 255, 255)}   # person=magenta, sack=yellow (BGR)
NAMES = {0: "person", 1: "sack"}

_model_cache: dict[str, YOLO] = {}


def load_model(model_path: str) -> YOLO:
    if model_path not in _model_cache:
        _model_cache[model_path] = YOLO(model_path)
    return _model_cache[model_path]


def list_models() -> list[str]:
    found = sorted(str(p) for p in MODELS_DIR.rglob("*.pt"))
    return found or [DEFAULT_PT]


@dataclass
class LabConfig:
    """Every knob the Lab exposes. Defaults = deployed sack-detector-edge (.env)."""
    # detection
    model_path: str = DEFAULT_PT
    conf: float = 0.25              # HAILO_PREFILTER_CONF
    iou: float = 0.70               # NMS-IoU (baked on .hef; tunable here on .pt)
    classes: tuple[int, ...] = (0, 1)
    # sampling
    frame_start: int = 0
    frame_end: int = 0              # 0 = to end
    frame_stride: int = 2
    device: str = "mps"             # mps | cpu
    tracker_type: str = "centroid"        # deterministic local tracker; not ByteTrack
    track_buffer: int = 30
    match_thresh: float = 0.70
    line: tuple[int, int, int, int] | None = None   # x1,y1,x2,y2 (None = no counting yet)
    exclusion_zones: list[dict] = field(default_factory=list)
    inflip: bool = True
    conf_split: float = 0.60        # CONF_THRESHOLD confirmed/flagged
    roi_dedup_px: int = 25
    roi_dedup_frames: int = 120
    count_cooldown_frames: int = 40
    ground_truth: int | None = None
    tolerance_pct: float | None = None
    heal: bool = False
    heal_require_person: bool = True
    hist_len: int = 8
    predictor: str = "quadratic"
    trace_full: bool = False
    scorer_mode: str = "passthrough"
    scorer_config: dict = field(default_factory=dict)


@dataclass
class LabResult:
    output_video: str = ""
    frames_processed: int = 0
    frames_total: int = 0
    max_sack_per_frame: int = 0
    avg_sack_per_frame: float = 0.0
    confirmed: int | None = None
    flagged: int | None = None
    recovered: int | None = None
    per_crossing: list = field(default_factory=list)
    events: list = field(default_factory=list)
    summary: dict = field(default_factory=dict)
    config: dict = field(default_factory=dict)
    video_width: int = 0
    video_height: int = 0
    fps: float = 0.0
    frame_count: int = 0


def side_of_line(point: tuple[float, float], line: tuple[float, float, float, float]) -> int:
    """Return -1/0/1 for the signed side of an oriented pixel line."""
    x1, y1, x2, y2 = line
    cross = (x2 - x1) * (point[1] - y1) - (y2 - y1) * (point[0] - x1)
    return 1 if cross > 1e-9 else -1 if cross < -1e-9 else 0


def validate_line(line: object, width: int, height: int) -> tuple[int, int, int, int] | None:
    """Validate a pixel line once video dimensions are known."""
    if line is None:
        return None
    if not isinstance(line, (list, tuple)) or len(line) != 4:
        raise ValueError("line must contain four pixel coordinates")
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(float(v)) for v in line):
        raise ValueError("line coordinates must be finite numbers")
    result = tuple(int(v) for v in line)
    x1, y1, x2, y2 = result
    if (x1, y1) == (x2, y2):
        raise ValueError("line must not be degenerate")
    if not all(0 <= x < width and 0 <= y < height for x, y in zip(result[::2], result[1::2])):
        raise ValueError(f"line must be inside the {width}x{height} frame")
    return result


def score_crossing(event: dict, *, mode: str = "passthrough", conf_split: float = 0.60,
                   features: dict | None = None, scorer_config: dict | None = None) -> dict:
    """Return a truthful, dependency-free crossing verdict and audit fields.

    Passthrough deliberately preserves the historical confidence split. Fused is
    opt-in and uses centered [0, 1] features; absent features remain neutral.
    Vetoes require explicit evidence in ``features`` and never infer geometry.
    """
    mode = str(mode or "passthrough").lower()
    if mode not in {"passthrough", "fused"}:
        raise ValueError("scorer mode must be passthrough or fused")
    features = dict(features or {})
    config = {"conf_split": float(conf_split), "threshold_confirmed": 0.65,
              "threshold_flagged": 0.45, "logit_b0": 0.0, "recovered_bias": 0.0,
              "weights": {"detection_conf": 1.0, "track_stability": 1.0,
                          "velocity_alignment": 1.0, "motion_evidence": 1.0,
                          "identity_integrity": 1.0, "healer_link_quality": 1.0,
                          "static_in_zone_penalty": -1.0, "box_aspect_sanity": 1.0}}
    config.update(scorer_config or {})
    weights = dict(config.get("weights") or {})
    config["weights"] = weights
    breakdown = {"features": {}, "contributions": {}, "veto": None}
    provenance = {}
    if mode == "passthrough":
        verdict = "confirmed" if float(event["detection_conf"]) >= float(conf_split) else "flagged"
        score = None
    else:
        logit = float(config["logit_b0"])
        for name, weight in weights.items():
            raw = features.get(name, 0.5)
            try:
                raw = min(1.0, max(0.0, float(raw)))
            except (TypeError, ValueError):
                raw = 0.5
            centered = 2.0 * raw - 1.0
            contribution = float(weight) * centered
            breakdown["features"][name] = {"raw": raw, "centered": centered}
            breakdown["contributions"][name] = contribution
            logit += contribution
        if features.get("recovered"):
            logit += float(config["recovered_bias"])
        score = 1.0 / (1.0 + math.exp(-max(-60.0, min(60.0, logit))))
        vetoes = (("non_sack", "non_sack_class"), ("dedup_collision", "dedup_collision"),
                  ("out_of_frame", "out_of_frame"), ("static_in_zone_phantom", "static_in_zone_phantom"))
        for evidence_key, veto_name in vetoes:
            if features.get(evidence_key) is True:
                breakdown["veto"] = veto_name
                provenance[evidence_key] = features.get(f"{evidence_key}_evidence", True)
                break
        if breakdown["veto"]:
            verdict = "dropped"
        elif score >= float(config["threshold_confirmed"]):
            verdict = "confirmed"
        elif score >= float(config["threshold_flagged"]):
            verdict = "flagged"
        else:
            verdict = "dropped"
    return {"score": score, "verdict": verdict, "score_breakdown": breakdown,
            "scorer": {"mode": mode, "config": config}, "feature_provenance": provenance}


def derive_crossing_event(previous_side, current_side, inflip, frame_index, timestamp_ms,
                          track_id, detection, exclusion_zone, conf_split, sequence,
                          path: TrackPath | None = None, predictor: str = "quadratic",
                          scorer_mode: str = "passthrough", scorer_config: dict | None = None,
                          scorer_features: dict | None = None):
    """Build one auditable event from a genuine non-zero side transition."""
    if previous_side == 0 or current_side == 0 or previous_side == current_side:
        return None
    # The API exposes semantic directions, not implementation-side names.
    # The oriented line defines negative->positive as "in" for this run.
    direction = {(-1, 1): "in", (1, -1): "out"}[(previous_side, current_side)]
    if inflip:
        direction = "out" if direction == "in" else "in"
    status = "excluded" if exclusion_zone is not None else (
        "confirmed" if float(detection["confidence"]) >= conf_split else "flagged"
    )
    path_provenance = None
    if path is not None:
        path_provenance = {
            "points": [point.to_dict() for point in path.recent_points],
            "predictor": predictor_metadata(path, predictor),
            "total_displacement": float(path.total_displacement),
        }
    event = {
        "event_id": f"crossing-{sequence:06d}", "sequence": sequence,
        "frame_index": int(frame_index), "timestamp_ms": int(timestamp_ms),
        "track_id": int(track_id), "class_id": int(detection["class_id"]),
        "centroid": [float(detection["centroid"][0]), float(detection["centroid"][1])],
        "bbox": [int(v) for v in detection["bbox"]], "direction": direction,
        "status": status, "recovery": "none",
        "detection_conf": float(detection["confidence"]),
        "exclusion_zone_id": exclusion_zone.get("zone_id") if exclusion_zone else None,
        "provenance": {
            "confidence": float(detection["confidence"]),
            "exclusion_zone_id": exclusion_zone.get("zone_id") if exclusion_zone else None,
            "tracker": "centroid", "conf_split": float(conf_split),
            "decision": {
                "raw_conf": float(detection["confidence"]),
                "dedup_hit": False, "cooldown_hit": False,
                "exclusion_hit": exclusion_zone is not None,
                "recovered": False,
                "reason": "exclusion_zone" if exclusion_zone is not None else status,
            },
            **({"path": path_provenance} if path_provenance is not None else {}),
        },
    }
    scored = score_crossing(event, mode=scorer_mode, conf_split=conf_split,
                            features=scorer_features, scorer_config=scorer_config)
    event["score"] = scored["score"]
    event["verdict"] = scored["verdict"]
    event["score_breakdown"] = scored["score_breakdown"]
    event["scorer"] = scored["scorer"]
    event["feature_provenance"] = scored["feature_provenance"]
    event["provenance"]["scorer"] = scored["scorer"]
    event["provenance"]["feature_provenance"] = scored["feature_provenance"]
    # Preserve the historical status in passthrough and for exclusions; fused
    # verdicts become the event status only for non-excluded crossings.
    if exclusion_zone is None:
        event["status"] = scored["verdict"]
    return event


def summarize_events(events: list[dict], ground_truth: int | None = None,
                     tolerance_pct: float | None = None) -> dict:
    """Summarize emitted crossing events and optionally compare confirmed count to GT."""
    summary: dict[str, object] = {
        "total": len(events), "total_crossings": len(events),
        "confirmed": sum(e["status"] == "confirmed" for e in events),
        "flagged": sum(e["status"] == "flagged" for e in events),
        "dropped": sum(e["status"] == "dropped" for e in events),
        "excluded": sum(e["status"] == "excluded" for e in events),
        "recovered": sum(e.get("recovery") != "none" for e in events),
    }
    if ground_truth is None:
        return summary
    if isinstance(ground_truth, bool) or not isinstance(ground_truth, int) or ground_truth < 0:
        raise ValueError("ground_truth must be a non-negative integer or None")
    if tolerance_pct is not None and (isinstance(tolerance_pct, bool)
            or not isinstance(tolerance_pct, (int, float))
            or not math.isfinite(float(tolerance_pct)) or tolerance_pct < 0):
        raise ValueError("tolerance_pct must be a non-negative finite number or None")
    confirmed_count = sum(e["status"] == "confirmed" for e in events)
    error = ((confirmed_count - ground_truth) / ground_truth
             if ground_truth else (0.0 if summary["confirmed"] == 0 else math.inf))
    summary.update({
        "ground_truth": ground_truth,
        "error_vs_ground_truth": error,
    })
    if tolerance_pct is not None:
        tolerance = float(tolerance_pct)
        tolerance_state = "within" if abs(error) <= tolerance else "over" if error > 0 else "under"
        summary.update({
            "tolerance_pct": tolerance,
            "tolerance_state": tolerance_state,
            "within_tolerance": tolerance_state == "within",
            "over_tolerance": tolerance_state == "over",
            "under_tolerance": tolerance_state == "under",
        })
    return summary


class CentroidTracker:
    """Greedy nearest-centroid tracker. A track expires after ``track_buffer`` frames."""
    def __init__(self, track_buffer=30, match_distance_px=25.0, cooldown_frames=120,
                 hist_len=8, predictor="quadratic", trace_full=False,
                 scorer_mode="passthrough", scorer_config=None):
        self.track_buffer = max(0, int(track_buffer)); self.match_distance_px = float(match_distance_px)
        self.cooldown_frames = max(0, int(cooldown_frames)); self._tracks = {}; self._next_id = 1; self._sequence = 0
        self.hist_len = max(1, int(hist_len)); self.predictor = str(predictor); self.trace_full = bool(trace_full)
        self.scorer_mode = str(scorer_mode); self.scorer_config = dict(scorer_config or {})
        self._paths: dict[int, TrackPath] = {}

    @property
    def active_track_ids(self):
        return sorted(self._tracks)

    @property
    def paths(self):
        return dict(self._paths)

    def update(self, frame_index, detections, line, inflip, conf_split, timestamp_ms, exclusion_zones=None):
        for tid in list(self._tracks):
            if frame_index - self._tracks[tid]["last_frame"] > self.track_buffer:
                self._paths[tid].mark_lost()
                del self._tracks[tid]
        unmatched = set(range(len(detections))); assignments = {}
        candidates = sorted((math.dist(self._tracks[tid]["centroid"], detections[i]["centroid"]), tid, i)
                            for tid in self._tracks for i in unmatched)
        for distance, tid, i in candidates:
            if i in unmatched and tid in self._tracks and distance <= self.match_distance_px:
                assignments[i] = tid; unmatched.remove(i)
        for i in sorted(unmatched):
            assignments[i] = self._next_id; self._next_id += 1
        events = []
        for i, detection in enumerate(detections):
            tid = assignments[i]; old = self._tracks.get(tid)
            path = self._paths.get(tid)
            if path is None:
                path = TrackPath(tid, detection["class_id"], self.hist_len, self.trace_full)
                self._paths[tid] = path
            path.append(PathPoint(frame=int(frame_index), t_ms=int(timestamp_ms),
                                  cx=float(detection["centroid"][0]), cy=float(detection["centroid"][1]),
                                  conf=float(detection["confidence"])))
            previous_side = old["side"] if old else 0
            current_side = side_of_line(detection["centroid"], line) if line else 0
            if current_side == 0: current_side = previous_side
            zone = next((z for z in (exclusion_zones or []) if z["enabled"] and point_in_polygon(detection["centroid"], z["points"])), None)
            event = derive_crossing_event(previous_side, current_side, inflip, frame_index,
                                          timestamp_ms, tid, detection, zone, conf_split, self._sequence + 1,
                                          path=path, predictor=self.predictor,
                                          scorer_mode=self.scorer_mode, scorer_config=self.scorer_config)
            if event and (old is None or frame_index - old.get("last_event_frame", -10**9) >= self.cooldown_frames):
                self._sequence += 1; event["event_id"] = f"crossing-{self._sequence:06d}"; event["sequence"] = self._sequence
                events.append(event)
                # Excluded crossings also consume cooldown: they must not spam logs/counts.
                last_event_frame = frame_index
            else:
                last_event_frame = old.get("last_event_frame", -10**9) if old else -10**9
            self._tracks[tid] = {"centroid": tuple(detection["centroid"]), "side": current_side,
                                 "last_frame": frame_index, "last_event_frame": last_event_frame}
        return events


def point_in_polygon(point: tuple[float, float], polygon: list[tuple[float, float]]) -> bool:
    """Return whether *point* is inside a polygon (boundary counts as inside).

    This is a pure, frame-independent even/odd ray-casting implementation.
    Callers validate polygon shape and coordinates before using it.
    """
    px, py = point
    inside = False
    for i, (x1, y1) in enumerate(polygon):
        x2, y2 = polygon[(i + 1) % len(polygon)]
        # Treat points on an edge as inside.
        cross = (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1)
        if abs(cross) <= 1e-9 and min(x1, x2) <= px <= max(x1, x2) and min(y1, y2) <= py <= max(y1, y2):
            return True
        if (y1 > py) != (y2 > py):
            x_at_y = x1 + (py - y1) * (x2 - x1) / (y2 - y1)
            if px < x_at_y:
                inside = not inside
    return inside


def validate_exclusion_zones(zones: object, width: int, height: int) -> list[dict]:
    """Validate and normalize configured pixel exclusion polygons."""
    if zones is None:
        return []
    if not isinstance(zones, list):
        raise ValueError("exclusion_zones must be a list")
    validated: list[dict] = []
    for index, zone in enumerate(zones):
        if not isinstance(zone, dict):
            raise ValueError(f"exclusion_zones[{index}] must be an object")
        zone_id = zone.get("zone_id")
        if not isinstance(zone_id, str) or not zone_id.strip():
            raise ValueError(f"exclusion_zones[{index}].zone_id must be a non-empty string")
        if zone.get("coordinate_space", "pixel") != "pixel":
            raise ValueError(f"exclusion_zones[{index}] has unsupported coordinate_space")
        if zone.get("mode", "hard_exclude") != "hard_exclude":
            raise ValueError(f"exclusion_zones[{index}] has unsupported mode")
        enabled = zone.get("enabled", True)
        if not isinstance(enabled, bool):
            raise ValueError(f"exclusion_zones[{index}].enabled must be boolean")
        points = zone.get("points")
        if not isinstance(points, list) or len(points) < 3:
            raise ValueError(f"exclusion_zones[{index}].points must contain at least 3 points")
        polygon: list[tuple[float, float]] = []
        for point_index, point in enumerate(points):
            if not isinstance(point, (list, tuple)) or len(point) != 2:
                raise ValueError(f"exclusion_zones[{index}].points[{point_index}] must be [x, y]")
            x, y = point
            if isinstance(x, bool) or isinstance(y, bool) or not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
                raise ValueError(f"exclusion_zones[{index}].points[{point_index}] must be numeric")
            x, y = float(x), float(y)
            if not math.isfinite(x) or not math.isfinite(y):
                raise ValueError(f"exclusion_zones[{index}].points[{point_index}] must be finite")
            if not (0 <= x < width and 0 <= y < height):
                raise ValueError(f"exclusion_zones[{index}].points[{point_index}] is outside the {width}x{height} frame")
            polygon.append((x, y))
        if len(set(polygon)) != len(polygon):
            raise ValueError(f"exclusion_zones[{index}] contains repeated vertices")

        def orientation(a, b, c):
            cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            if abs(cross) <= 1e-9:
                return 0
            return 1 if cross > 0 else -1

        def on_segment(a, b, point):
            return (min(a[0], b[0]) <= point[0] <= max(a[0], b[0])
                    and min(a[1], b[1]) <= point[1] <= max(a[1], b[1]))

        def segments_intersect(a, b, c, d):
            ab_c, ab_d = orientation(a, b, c), orientation(a, b, d)
            cd_a, cd_b = orientation(c, d, a), orientation(c, d, b)
            if ab_c * ab_d < 0 and cd_a * cd_b < 0:
                return True
            return ((ab_c == 0 and on_segment(a, b, c))
                    or (ab_d == 0 and on_segment(a, b, d))
                    or (cd_a == 0 and on_segment(c, d, a))
                    or (cd_b == 0 and on_segment(c, d, b)))

        for edge_index, (a, b) in enumerate(zip(polygon, polygon[1:] + polygon[:1])):
            for other_index in range(edge_index + 1, len(polygon)):
                if other_index == edge_index + 1 or (edge_index == 0 and other_index == len(polygon) - 1):
                    continue
                c = polygon[other_index]
                d = polygon[(other_index + 1) % len(polygon)]
                if segments_intersect(a, b, c, d):
                    raise ValueError(f"exclusion_zones[{index}] has self-intersecting edges")
        area2 = sum(polygon[i][0] * polygon[(i + 1) % len(polygon)][1] - polygon[(i + 1) % len(polygon)][0] * polygon[i][1] for i in range(len(polygon)))
        if abs(area2) <= 1e-9:
            raise ValueError(f"exclusion_zones[{index}] is a degenerate polygon")
        frame_ref = zone.get("frame_ref", 0)
        if isinstance(frame_ref, bool) or not isinstance(frame_ref, (int, float)) or not math.isfinite(float(frame_ref)):
            raise ValueError(f"exclusion_zones[{index}].frame_ref must be a finite number")
        validated.append({**zone, "enabled": enabled, "points": polygon, "frame_ref": frame_ref})
    return validated


def run_inference(video_path: str, cfg: LabConfig, progress=None) -> LabResult:
    """Run detection overlay and optional V1 counting. ``line=None`` is v0-compatible."""
    if cv2 is None or np is None:
        raise ValueError("inference dependencies are not installed")
    model = load_model(cfg.model_path)
    cap = cv2.VideoCapture(video_path)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    line = validate_line(cfg.line, w, h)
    exclusion_zones = validate_exclusion_zones(cfg.exclusion_zones, w, h)
    match_distance = max(float(cfg.roi_dedup_px), 50.0 * max(0.0, 1.0 - float(cfg.match_thresh)))
    tracker = CentroidTracker(
        cfg.track_buffer, match_distance,
        max(cfg.count_cooldown_frames, cfg.roi_dedup_frames),
        hist_len=cfg.hist_len, predictor=cfg.predictor, trace_full=cfg.trace_full,
        scorer_mode=cfg.scorer_mode, scorer_config=cfg.scorer_config,
    ) if line else None
    events = []

    raw_file = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    raw = raw_file.name
    raw_file.close()
    writer = cv2.VideoWriter(raw, cv2.VideoWriter_fourcc(*"mp4v"), fps / max(1, cfg.frame_stride), (w, h))

    fi, n_written, max_sack, sum_sack = -1, 0, 0, 0
    end = cfg.frame_end or 10**12
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        fi += 1
        if fi < cfg.frame_start or fi > end:
            if fi > end:
                break
            continue
        if fi % cfg.frame_stride != 0:
            continue
        if progress and total:
            progress(min(1.0, fi / total), f"frame {fi}/{total}")
        res = model.predict(frame, conf=cfg.conf, iou=cfg.iou, classes=list(cfg.classes),
                            device=cfg.device, verbose=False)[0]
        n_sack = 0
        sack_detections = []
        for b in res.boxes:
            c = int(b.cls); cf = float(b.conf); x1, y1, x2, y2 = map(int, b.xyxy[0])
            col = COLORS.get(c, (0, 255, 0))
            centroid = ((x1 + x2) * 0.5, (y1 + y2) * 0.5)
            excluded_zone = next((z for z in exclusion_zones
                                  if z["enabled"] and point_in_polygon(centroid, z["points"])), None)
            if excluded_zone is not None and c in (0, 1):
                col = (0, 0, 255)
                label = f"EXCLUDED {NAMES.get(c, c)} {cf:.2f}"
            else:
                label = f"{NAMES.get(c, c)} {cf:.2f}"
            cv2.rectangle(frame, (x1, y1), (x2, y2), col, 2)
            cv2.putText(frame, label, (x1, max(12, y1 - 4)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, col, 1)
            if c == 1:
                n_sack += 1
                sack_detections.append({"class_id": c, "confidence": cf,
                                        "centroid": centroid, "bbox": [x1, y1, x2, y2]})
        frame_events = tracker.update(fi, sack_detections, line, cfg.inflip, cfg.conf_split,
                                      round(fi * 1000.0 / fps), exclusion_zones) if tracker else []
        events.extend(frame_events)
        if line:
            x1, y1, x2, y2 = line
            cv2.line(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        for event in frame_events:
            ex, ey = map(int, event["centroid"])
            marker_color = (0, 255, 0) if event["status"] == "confirmed" else (0, 165, 255) if event["status"] == "flagged" else (0, 0, 255)
            cv2.circle(frame, (ex, ey), 8, marker_color, -1)
            cv2.putText(frame, f"#{event['track_id']} {event['status']}", (ex + 10, ey),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, marker_color, 2)
        for zone in exclusion_zones:
            if zone["enabled"]:
                pts = [(int(round(x)), int(round(y))) for x, y in zone["points"]]
                cv2.polylines(frame, [np.array(pts, dtype="int32")], True, (255, 0, 0), 2)
                cv2.putText(frame, str(zone["zone_id"]), pts[0], cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 1)
        cv2.putText(frame, f"conf>={cfg.conf:.2f} iou={cfg.iou:.2f} f{fi}", (8, 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 255), 2)
        writer.write(frame)
        n_written += 1; max_sack = max(max_sack, n_sack); sum_sack += n_sack
    cap.release(); writer.release()

    out_file = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    out = out_file.name
    out_file.close()
    ffmpeg = subprocess.run(["ffmpeg", "-y", "-i", raw, "-c:v", "libx264", "-pix_fmt", "yuv420p",
                             "-crf", "20", "-movflags", "+faststart", out], capture_output=True)
    if ffmpeg.returncode != 0 or not Path(out).is_file() or Path(out).stat().st_size == 0:
        detail = ffmpeg.stderr.decode(errors="replace").strip().splitlines()[-1] if ffmpeg.stderr else "unknown ffmpeg error"
        raise ValueError(f"ffmpeg encoding failed: {detail}")

    summary = summarize_events(events, cfg.ground_truth, cfg.tolerance_pct) if line else {}
    return LabResult(
        output_video=out,
        frames_processed=n_written,
        frames_total=total,
        max_sack_per_frame=max_sack,
        avg_sack_per_frame=round(sum_sack / max(1, n_written), 2),
        confirmed=summary["confirmed"] if line else None,
        flagged=summary["flagged"] if line else None,
        recovered=summary["recovered"] if line else None,
        per_crossing=events if line else [], events=events if line else [],
        summary=summary, config=asdict(cfg), video_width=w, video_height=h,
        fps=float(fps), frame_count=total,
    )
