"""Shared track history and motion prediction primitives for the Lab backend."""
from __future__ import annotations

from collections import deque
from dataclasses import asdict, dataclass
import math


@dataclass(frozen=True)
class PathPoint:
    frame: int
    t_ms: int
    cx: float
    cy: float
    conf: float

    def to_dict(self) -> dict:
        return asdict(self)


class TrackPath:
    """Bounded recent centroid history with life-level displacement metadata."""

    def __init__(self, track_id: int, class_id: int, hist_len: int = 8, trace_full: bool = False):
        if int(hist_len) < 1:
            raise ValueError("hist_len must be at least 1")
        self.track_id = int(track_id)
        self.class_id = int(class_id)
        self.hist_len = int(hist_len)
        self.trace_full = bool(trace_full)
        self._points = deque(maxlen=self.hist_len)
        self._full_points = [] if self.trace_full else None
        self._first_point: PathPoint | None = None
        self.born_frame: int | None = None
        self.last_frame: int | None = None
        self.alive = True
        self.total_displacement = 0.0

    @property
    def points(self) -> list[PathPoint]:
        if self.trace_full:
            return list(self._full_points or [])
        return list(self._points)

    @property
    def recent_points(self) -> list[PathPoint]:
        return list(self._points)

    def append(self, point: PathPoint) -> None:
        if not isinstance(point, PathPoint):
            raise TypeError("point must be a PathPoint")
        if self.last_frame is not None and point.frame < self.last_frame:
            raise ValueError("path points must be appended in frame order")
        if self._first_point is None:
            self._first_point = point
            self.born_frame = point.frame
        self._points.append(point)
        if self._full_points is not None:
            self._full_points.append(point)
        self.last_frame = point.frame
        self.total_displacement = math.dist(
            (self._first_point.cx, self._first_point.cy), (point.cx, point.cy)
        )
        self.alive = True

    def mark_lost(self) -> None:
        self.alive = False

    def to_dict(self, slice_len: int | None = None) -> dict:
        pts = self.points if slice_len is None else self.points[-max(0, int(slice_len)):]
        return {
            "track_id": self.track_id,
            "class_id": self.class_id,
            "points": [p.to_dict() for p in pts],
            "born_frame": self.born_frame,
            "last_frame": self.last_frame,
            "total_displacement": float(self.total_displacement),
            "alive": self.alive,
        }


def _velocity(path: TrackPath) -> tuple[float, float]:
    points = path.recent_points
    if len(points) < 2:
        return 0.0, 0.0
    dx = dy = 0.0
    elapsed = 0.0
    for before, after in zip(points, points[1:]):
        dt = max(1, after.frame - before.frame)
        dx += (after.cx - before.cx) / dt
        dy += (after.cy - before.cy) / dt
        elapsed += 1
    return dx / elapsed, dy / elapsed


def _quadratic_component(points: list[PathPoint], attr: str, gap: int) -> float:
    # Least-squares fit y = a*t² + b*t + c against frame offsets.  A tiny
    # Gaussian elimination keeps this module dependency-free and deterministic.
    if len(points) < 3:
        raise ValueError("quadratic prediction needs at least three points")
    origin = points[-1].frame
    rows = []
    for p in points:
        t = float(p.frame - origin)
        rows.append(([t * t, t, 1.0], float(getattr(p, attr))))
    matrix = [[0.0] * 4 for _ in range(3)]
    for basis, value in rows:
        for i in range(3):
            for j in range(3):
                matrix[i][j] += basis[i] * basis[j]
            matrix[i][3] += basis[i] * value
    for col in range(3):
        pivot = max(range(col, 3), key=lambda r: abs(matrix[r][col]))
        if abs(matrix[pivot][col]) < 1e-12:
            raise ValueError("quadratic points are singular")
        matrix[col], matrix[pivot] = matrix[pivot], matrix[col]
        divisor = matrix[col][col]
        matrix[col] = [v / divisor for v in matrix[col]]
        for row in range(3):
            if row == col:
                continue
            factor = matrix[row][col]
            matrix[row] = [matrix[row][j] - factor * matrix[col][j] for j in range(4)]
    a, b, c = (matrix[i][3] for i in range(3))
    t = float(gap)
    return a * t * t + b * t + c


def predictor_metadata(path: TrackPath, predictor: str = "quadratic") -> dict:
    requested = str(predictor)
    if requested == "optical-flow":
        return {"requested": requested, "supported": False, "status": "unsupported", "points_used": len(path.recent_points)}
    if requested not in {"linear", "quadratic"}:
        raise ValueError(f"unsupported predictor: {requested}")
    points_used = len(path.recent_points)
    status = "supported"
    if requested == "quadratic" and points_used < 3:
        status = "fallback_linear"
    return {"requested": requested, "supported": True, "status": status, "points_used": points_used}


def predict(path: TrackPath, gap: int, predictor: str = "quadratic") -> tuple[float, float]:
    if int(gap) < 0:
        raise ValueError("gap must be non-negative")
    metadata = predictor_metadata(path, predictor)
    if not metadata["supported"]:
        raise NotImplementedError("optical-flow predictor is not supported by the backend")
    if not path.recent_points:
        return 0.0, 0.0
    last = path.recent_points[-1]
    if predictor == "quadratic" and metadata["status"] == "supported":
        try:
            return (_quadratic_component(path.recent_points, "cx", gap),
                    _quadratic_component(path.recent_points, "cy", gap))
        except ValueError:
            pass
    vx, vy = _velocity(path)
    return last.cx + vx * int(gap), last.cy + vy * int(gap)
