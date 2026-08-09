# PATH / Trajectory subsystem — spec

The "path" of a tracked object = the ordered trail of its centroids over time.
One subsystem produces it once; five features consume it (trail viz, re-link, scorer, trajectory-crossing, re-ID).
Grounded in the loom-oracle POC: `track_healer.py` (history + velocity + corridor) and `_cv_lib/trails.py` (the cyan trail already drawn in overlays).

## 1. Data model

```
PathPoint  = { frame: int, t_ms: int, cx: float, cy: float, conf: float }
TrackPath  = { track_id, class_id, points: PathPoint[] (ring buffer, cap = hist_len),
               born_frame, last_frame, total_displacement, alive: bool }
```
- One `TrackPath` per active track_id. Points appended each frame the track is seen.
- Ring buffer capped at `hist_len` (recent shape is what matters; full trail kept only if `trace_full` is on, for the Trace tab / export).

## 2. Computation (single source, in the tracker step)

1. After the tracker assigns ids, append each track's centroid → its `TrackPath`.
2. `velocity` = mean delta over the last N points; `curvature` = 2nd-order fit over last N (for the quadratic predictor).
3. `total_displacement` = net |last − first| over the track's life (used by exclusion / static-pile test).
4. On track loss, keep the path `max_gap` frames before dropping (so a re-link can still read it).

## 3. Motion predictor (shared — the SP-3 lever)

`predict(track_path, gap) -> (px, py)` with a pluggable model:
- **linear** (default): last centroid + velocity·gap. Cheap; fails when the worker turns mid-carry (POC finding).
- **quadratic**: 2nd-order extrapolation from the last N points → follows a curved carry. Cheap; recommended first upgrade.
- **optical-flow**: dense/sparse flow at the last box → most accurate, heaviest; only if quadratic is not enough.
One predictor feeds BOTH the healer corridor and tracker re-ID (don't fork the math).

## 4. Consumers (one path, five uses)

1. **Trail overlay** — draw the last K points as a polyline (the cyan trail); toggle in Output/Trace.
2. **Re-link corridor (TrackHealer)** — a reappearing birth re-links to a pending lost path only if it falls within `corridor_px` of `predict(lost_path, gap)` AND on the opposite side of the line. Gate: `require_person`, `max_gap`.
3. **Scorer contributors** — from the path: `direction` (cosine of velocity vs the line's IN normal), `speed_consistency` (velocity variance = low under clean carry, high under jitter/occlusion), `track_age` (points count / stability).
4. **Trajectory crossing (optional counting mode)** — count when the PATH segment crosses the line (robust to a single-frame miss), vs per-frame centroid crossing.
5. **Exclusion / static-pile test** — a track whose `total_displacement ≈ 0` and lives inside the pile zone is static → veto/soft-penalty the crossing (see Q2 exclusion reframe).

## 5. Config knobs

| knob | default | meaning |
|---|---|---|
| `hist_len` | 8 | ring-buffer length (recent shape) |
| `predictor` | quadratic | linear \| quadratic \| optical-flow |
| `corridor_px` | 160 | re-link tolerance around predicted position |
| `near_px` | 140 | "near the line" band for disappear/birth |
| `max_gap` | 90 | frames a lost path stays re-linkable |
| `trail_len` | 30 | points drawn in the overlay |
| `static_disp_px` | 20 | ≤ this net displacement ⇒ treated as static pile |
| `trace_full` | off | keep full (not ring-capped) path for Trace/export |

## 6. WebUI surfacing (Trace / Debug tab)

- Draw every track's trail (colour by id); dashed = predicted continuation across a gap; arrow = a re-link (from→to id).
- Click a crossing → highlight its path + the contributor values derived from it (direction/speed/age) + the fused score.
- Slider: `trail_len`; toggle: predicted-vs-actual overlay; toggle: static-track dimming.

## 7. Provenance / export

Each crossing event carries the path slice that produced it: `points[]` near the crossing frame, the predictor used, the corridor distance if healed, and `total_displacement`.
This makes a healed/flagged count auditable ("why did this count?") and lets A/B diff explain a delta by the path, not just the number.

## 8. Where to build (reference impls — do not reinvent)

- history + velocity + corridor: `loom-oracle/.claude/skills/_cv_lib/track_healer.py`
- trail drawing: `loom-oracle/.claude/skills/_cv_lib/trails.py`
- integration point in the lab: `webui/lab_core.py` `CentroidTracker` (add `TrackPath` per track) → feed `derive_crossing_event` + the healer + the scorer.
- keep the predictor and the path model in ONE module (`lab_path.py`) so tracker, healer, scorer, and Trace tab share it.

— Loom Oracle (AI), 2026-08-10
