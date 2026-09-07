# Edge counting stack — lift inventory

Author: Loom Oracle (AI). Date: 2026-09-07.
Question asked: can the device counting stack be lifted into a shared package that serves both the device and the Lab, differing only in detection backend?

**Verdict up front: it lifts behind a defined backend interface — and the interface already exists in the edge repo.**
Stronger than that: the whole counting stack was executed off-device during this investigation, on Python 3.14.5 with numpy 2.4.5, with no Hailo, no picamera2, no MQTT and no SQLite, and it emitted a real crossing count.
Section 7 records that run.

## Path roots used in citations

| Alias | Absolute path |
|---|---|
| `EDGE` | `/Users/pitikorn/Work/BSCP/sack-detector-edge/detector` |
| `EDGEROOT` | `/Users/pitikorn/Work/BSCP/sack-detector-edge` |
| `LAB` | `/Users/pitikorn/Work/BSCP/sack-train-ml/.claude/worktrees/experiment-lab` |
| `SKILL` | `/Users/pitikorn/pam/loom-oracle/.claude/skills` |

Every claim below cites `path:line`.
Where I could not evidence something, it is in the "suspected, unverified" list at the end.

---

## 1. Which modules constitute the counting stack

The stack splits cleanly into a **core** (the algorithm) and a **glue layer** (the device loop).
The core is what lifts.
The glue is what does not, and does not need to.

### Core — the counting algorithm

| Module | Role (one line) |
|---|---|
| `EDGE/src/tracking/byte_tracker/byte_tracker.py` | The real ByteTrack: two-stage IoU+Kalman association, class `BYTETracker` at :125, `update()` at :138. |
| `EDGE/src/tracking/byte_tracker/kalman_filter.py` | Constant-velocity Kalman filter used by each `STrack` (`import scipy.linalg` at :12). |
| `EDGE/src/tracking/byte_tracker/matching.py` | IoU cost matrix + Jonker-Volgenant assignment (`import lap` at :8, `linear_assignment` at :28). |
| `EDGE/src/tracking/byte_tracker/basetrack.py` | Track id counter and lifecycle states (`BaseTrack.reset_id`, file is 59 lines). |
| `EDGE/src/tracking/tracker.py` | Two wrappers: `ByteTrackWrapper` (:163, production) and `BoxmotTracker` (:112, experiment-only per :19-20). Normalises detections `[N,6]` → tracks `[M,7]`. |
| `EDGE/src/counting/roi_config.py` | `CountEvent` dataclass (:17), `BaseRegion` (:66), and the **dedup** primitive `_is_spatially_duplicate` (:91) + `_record_count` (:151). Also `PolygonRegion` (:228) / `CircleRegion` (:261), unused by the line path. |
| `EDGE/src/counting/line_counter.py` | Line geometry + crossing decision + cooldown. `LineRegion` (:136), crossing test by cross-product sign flip (:232-252), exclusion zones (:294), cooldown/hysteresis (:306-329), dedup call (:331), count emission (:337-360). `RegionManager` (:412) owns track history, stale-id eviction (:708-740) and the flagged-item ledger (:748-993). Also line-coordinate rescaling `scale_line_shape_to_frame` (:46) and direction resolution `resolve_line_direction_map` (:364). |
| `EDGE/src/detector/detection_split.py` | Class veto `keep_class_for_count` (:98) — called by `RegionManager.update` at line_counter.py:680; and person/sack split `split_sack_person` (:61). Module docstring states zero heavy imports (:3). |
| `EDGE/src/counting/crossing_scorer.py` | The confirm/flag/drop verdict model. `CrossingScorer.classify`, passthrough vs fused modes, hard vetoes `make_box_size_veto` / `make_static_in_zone_phantom_veto`. Docstring at :1-8 states it imports only `math` at module scope. |
| `EDGE/src/counting/scorer_features.py` | Pure feature extraction feeding the scorer; `import math` is its only import (:50). |
| `EDGE/src/tracking/track_healer.py` | Occlusion re-link that remaps a reappeared track id onto the occluded canonical id before the counter sees it. `build_healer(config, p1, p2)` (:418) takes a plain dict; `maybe_heal` (:447) is a passthrough when the healer is None. |
| `EDGE/src/tracking/motion_predictor.py` | Trajectory extrapolation used by the healer (`import math` at :29 is its only import). |
| `EDGE/src/tracking/identity_firewall.py` | Id-hijack scoring signal (`import math` at :64 is its only import). |
| `EDGE/src/tracking/birth_crossing_inference.py` | Synthesises a FLAGGED crossing for a track born already past the line; config carried in a `BirthCrossingConfig` dataclass (:84-85 imports are `math`, `dataclasses`, `typing`). |

### Glue — the device loop (does NOT lift, and should not)

| Module | Role |
|---|---|
| `EDGE/src/detector/detection_loop.py` | One 1,900-line function `run_detection(args, context, backend, camera_service)` (:667). It is the ONLY place that wires infer → tracker → healer → `RegionManager.update` → scorer verdict → journal → MQTT → overlay → capture. |
| `EDGE/src/detector/sack_detector.py` | `DetectorService`; owns argparse (:479-509), the backend factory `_create_backend` (:2450), and MQTT command handling. |
| `EDGE/src/detector/count_journal.py` | Durable SQLite journal of confirmed/flagged events (`import sqlite3` at :13, `CountJournal` at :117). Injected into the loop as `context["count_journal"]` (detection_loop.py:1816). |
| `EDGE/src/mqtt/publisher.py` | `publish_detection_count` / `publish_flagged` — called only from detection_loop.py:2412 and :2439. |
| `EDGE/src/detector/overlay.py` | Drawing. Mostly pure cv2, but `draw_stamp_overlay` reads `settings.CONTAINER_ID` / `YARD_LOCATION` / `COMPANY_CODE` / `get_runtime_device_name()` (:116-119). |

**Where the count decision actually lives — important.**
`LineRegion.update` decides *a crossing happened* and increments `in_count`/`out_count` (line_counter.py:337-340).
It does NOT decide *confirmed vs flagged vs dropped*.
That verdict is inline in `run_detection` at detection_loop.py:1936-2005, followed by a revert of the auto-increment for flagged events at :2017-2019.
So the confirmed/flagged split is **glue-resident today**, even though `CrossingScorer` (the model) is a clean pure module.
Anything lifting "the counting engine" must lift that ~70-line block out of `run_detection` too, or the two codebases will still disagree on the split.

---

## 2. What each imports, classified

### PURE — numpy / scipy / lap / cv2 / stdlib only, no device anything

Verified by opening each file's import block.

| Module | Imports |
|---|---|
| `crossing_scorer.py` | `math` only, at :138. `from_settings()` imports settings *lazily inside the method* (docstring :5-8). |
| `scorer_features.py` | `math` only, at :50. |
| `identity_firewall.py` | `math` only, at :64. |
| `motion_predictor.py` | `math` only, at :29. |
| `track_healer.py` | `math`, `collections`, and `.motion_predictor` (:70-73). |
| `birth_crossing_inference.py` | `math`, `dataclasses`, `typing` (:83-85). |
| `detection_split.py` | `typing` only (:19). |
| `byte_tracker/byte_tracker.py` | `numpy`, `collections`, siblings (:7-12). |
| `byte_tracker/kalman_filter.py` | `numpy`, `scipy.linalg` (:11-12). |
| `byte_tracker/matching.py` | `numpy`, `lap` (:7-8). |
| `byte_tracker/basetrack.py` | `numpy`, `collections` (:5-6). |

### NEEDS INTERFACE — takes detections in, emits events out, but reads one injectable thing

| Module | What it constructs / reaches for | Where |
|---|---|---|
| `counting/line_counter.py` | `from src.config import settings` (:12). Reads `settings.REVERSE_DIRECTION_WARNING_*` (:196-199), `settings.COUNT_COOLDOWN_FRAMES` (:315), `settings.COUNT_HYSTERESIS_CP_MIN` (:323). Also `cv2.pointPolygonTest` for exclusion zones (:295). | All reads are **inside methods**, i.e. late-bound module attribute lookups — already monkeypatchable, already the seam. |
| `counting/roi_config.py` | `from src.config import settings` (:11); reads `settings.ROI_DEDUP_DISTANCE_PX` and `settings.ROI_DEDUP_FRAMES` (:113-114). `cv2.pointPolygonTest` at :249 (polygon region only). | Same: read inside `_is_spatially_duplicate`, not at import. |
| `tracking/tracker.py` | `from src.config import settings` (:11); `ByteTrackWrapper.__init__` reads `settings.BYTETRACK_TRACK_THRESH / _TRACK_BUFFER / _MATCH_THRESH` at :180-182 — **but only as the fallback when the constructor arg is None**. All three are already explicit optional parameters (:173-177). | This module is already injectable today with zero change. |
| `detector/overlay.py` | `from src.config import settings` (:17) and `from src.counting.line_counter import resolve_line_direction_map` (:18). Device identity fields at :116-119. | Only `draw_stamp_overlay` needs device identity. `draw_configured_line` (:158) and `draw_bbox_label` (:196) do not. |

### ENTANGLED — device-inseparable

| Module | What entangles it | Where |
|---|---|---|
| `detector/hailo_backend.py` | `from hailo_platform import HEF, VDevice, FormatType, HailoSchedulingAlgorithm` (:19-20), guarded by try/except setting `HAILO_AVAILABLE` (:22-23); `HailoInfer.__init__` raises `RuntimeError("hailo_platform not installed")` when absent (:39-40). | Import is safe off-device; **construction** is not. |
| `detector/detection_loop.py` | Imports `src.camera.camera_manager`, `src.camera.capture_manager`, `src.mqtt.publisher`, `src.detector.count_journal`, `src.system.health_monitor` (:18-70). Publishes MQTT at :2412 and :2439. Writes SQLite via the journal at :1816, :2089, :2117. | Irredeemably device glue. Not a lift candidate. |
| `detector/sack_detector.py` | MQTT service, argparse, camera service, `_create_backend` hardcodes `HailoBackend` (:2461-2468). | Device entrypoint. |
| `detector/count_journal.py` | `sqlite3` (:13), file-path DB. | Device durability layer; injected, so absent = RAM-only (detection_loop.py:216, :245 fall back to bare uuid4). |
| `config/settings.py` | **Import-time side effects**: reads `EDGEROOT/.env` (:15-22), reads `EDGE/config/tuning.yaml` (:41-52), calls `socket.gethostname()` (:144), and **creates a directory** — `SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)` at :31. | The only *import-time* filesystem write in the whole core dependency closure. It is benign (`exist_ok=True`) but it is a side effect a shared package should not have. |

---

## 3. Where the seam already is — evidence from cv-replay

File read in full: `SKILL/cv-replay/cv_replay.py` (250 lines).
Skill doc read in full: `SKILL/cv-replay/SKILL.md`.

### What it imports FROM the edge repo

Four imports, after `sys.path.insert(0, "/app")`:

```
from src.detector.hailo_backend import HailoBackend       # cv_replay.py:35
from src.tracking.tracker    import ByteTrackWrapper      # cv_replay.py:36
from src.counting.line_counter import RegionManager       # cv_replay.py:37
from src.detector import overlay as ovl                   # cv_replay.py:38
```

That is the entire edge surface it needs.
`src.config.settings` is pulled in **transitively** (via tracker.py:11, line_counter.py:12, overlay.py:17) but is never imported or referenced by name in cv_replay.py.

### What it constructs itself

- `HailoBackend(model_path=..., conf=..., iou=0.7, max_det=50, target_classes=CLASSES)` — cv_replay.py:113.
- `ByteTrackWrapper(track_buffer=...)` or `ByteTrackWrapper()` — cv_replay.py:114.
- `RegionManager(None, W, H)` — cv_replay.py:116. **`args=None`**, which is the entire "device config object" the counter needs; `RegionManager.__init__` then falls back to `count_sack_class_only=True`, `sack_class=1` (line_counter.py:504-507).
- The line, as a plain dict `{"type","x1","y1","x2","y2","inFlipped"}` fed to `rm.update_from_config([...])` — cv_replay.py:118-127. Same shape MQTT delivers.
- Its own confirmed/flagged split, re-implementing detection_loop's passthrough branch by hand: `if ev.confidence >= CONF` at cv_replay.py:190.
- Its own video I/O, CSV writers, overlay composition, and a fork of the healer imported from `SKILL/_cv_lib/track_healer.py` (cv_replay.py:22).

### What it did NOT need

No camera, no `CameraService`, no `picamera2`.
No MQTT client, no broker, no `src.mqtt.*`.
No SQLite / `count_journal`.
No `DetectorService`, no argparse `args` object, no `context` dict.
No `settings` reference by name — it never reads or sets a single knob explicitly.

**This is the direct evidence.** A tool outside the edge repo already runs the real tracker + real `LineRegion` + real dedup/cooldown by importing four names and constructing three objects.
The backend boundary is exactly `backend.infer(frame) -> (boxes, classes, confs)`; everything else is already decoupled.

### Two things cv-replay proves are wrong in its own docs

1. **`SKILL/cv-replay/SKILL.md` claims a `--backend pt` variant** ("`--backend pt` variant exists for Mac but only on RAW video", in Notes). `cv_replay.py` has **no `--backend` argument** — the argparse block is cv_replay.py:40-96 and defines `--hef` only, with `HailoBackend` hardcoded at :113. As of this file, the `.pt` path does not exist in cv-replay.
2. **`SKILL.md` claims "Runtime params baked to match edge (… ROI-dedup 300/50, ByteTrack buf30/match0.8)".** cv_replay.py bakes nothing of the sort: `ByteTrackWrapper()` at :114 takes match_thresh from `settings` (tracker.py:182), and ROI dedup is read from `settings` inside `roi_config.py:113-114`. With the shipped `tuning.yaml` mounted, those resolve to **match 0.7 and dedup 25px/120 frames** (measured — see §4), not 0.8 and 300/50. The 300/50 figures are settings.py's *code defaults* (settings.py:295-296), which `tuning.yaml` overrides. **The SKILL.md numbers are the pre-tuning.yaml world and are stale.**

---

## 4. The knobs, with real units and semantics

Resolution order for anything routed through `resolve_tunable`: **ENV VAR > `EDGE/config/tuning.yaml` > code default in settings.py** (settings.py:75-108).

| Knob | Read from | Type | Unit / semantic | Repo default (settings.py) | tuning.yaml value | Resolved on this Mac |
|---|---|---|---|---|---|---|
| `BYTETRACK_MATCH_THRESH` | settings.py:280 → tracker.py:182 → `BYTETracker.match_thresh` (byte_tracker.py:133) | float | **IoU-cost limit**, not a distance. Used as `cost_limit` in `lap.lapjv` over a `1 - IoU` cost matrix fused with detection score (matching.py:35, byte_tracker.py:188-190). Higher = looser association. | 0.7 | `tracker.match_thresh: 0.7` (tuning.yaml:41) | 0.7 (source: yaml) |
| `BYTETRACK_TRACK_BUFFER` | settings.py:279 → tracker.py:181 → byte_tracker.py:134-135 | int | **Frames** a lost track survives before removal (`max_time_lost`, scaled by `frame_rate/30`). | 30 | `tracker.track_buffer: 30` (tuning.yaml:40) | 30 (yaml) |
| `BYTETRACK_TRACK_THRESH` | settings.py:278 → tracker.py:180 → byte_tracker.py:131-132 | float | **Detection confidence**, 0-1. Splits high-conf (stage 1) from low-conf (stage 2) detections (byte_tracker.py:165-168). Also sets `det_thresh = track_thresh + 0.1`, the floor for *creating* a new track (byte_tracker.py:132, :241). | 0.3 | `tracker.track_thresh: 0.3` (tuning.yaml:39) | 0.3 (yaml) |
| `ROI_DEDUP_DISTANCE_PX` | settings.py:295 → roi_config.py:113 | int | **Pixels**. Radius around a recent counted centroid (and around its velocity-predicted position) within which a new crossing is suppressed as duplicate (roi_config.py:127-148). | 50 | `counting.roi_dedup_distance_px: 25` (tuning.yaml:57) | **25** (yaml) |
| `ROI_DEDUP_FRAMES` | settings.py:296 → roi_config.py:114 | int | **Frames**. How long a recorded count stays in the dedup pool (roi_config.py:117). | 300 | `counting.roi_dedup_frames: 120` (tuning.yaml:58) | **120** (yaml) |
| `CONF_THRESHOLD` | settings.py:337; used at detection_loop.py:1818 | float | **Detection confidence**, 0-1. Confirmed/flagged split *in passthrough mode*. Contract: must be ≥ CLI `--conf` or sub-floor items can never be flagged (settings.py:333-336; enforced sack_detector.py:170-178). | 0.60 | `counting.conf_threshold: 0.60` (tuning.yaml:61) | 0.6 (yaml) |
| `DETECTION_CONF` (CLI `--conf`) | settings.py:330; argparse default sack_detector.py:482 | float | **Detection confidence**, 0-1. NPU pre-filter passed to `HailoBackend(conf=...)` (sack_detector.py:2464). | 0.25 | `detection.conf: 0.25` (tuning.yaml:31) | 0.25 (yaml) |
| `COUNT_COOLDOWN_FRAMES` | settings.py:308 → line_counter.py:315 | int | **Frames**. Minimum gap before the *same track* may count in the **opposite** direction. Same-direction re-crossing is rejected outright regardless of cooldown (line_counter.py:308-311). | 40 | `counting.count_cooldown: 40` (tuning.yaml:59) | 40 (yaml) |
| `COUNT_HYSTERESIS_CP_MIN` | settings.py:318 → line_counter.py:322-323 | float | **Pixels** — perpendicular distance from the line, computed as `abs(cp2)/line_length`. settings.py:309-313 warns explicitly that this is NOT a fraction of line length. Env-only; no tuning.yaml entry. | 2.0 | (absent) | 2.0 |
| `TRACKER_TYPE` | settings.py:275 | str | Selects the **boxmot** tracker name (`botsort`/`bytetrack`) inside `_make_tracker` (tracker.py:125-126). | `"botsort"` | (absent — not a `resolve_tunable` knob) | `botsort` |
| `--tracker-mode` (CLI) | sack_detector.py:495-500 → detection_loop.py:834-840 | str | Chooses `BoxmotTracker` vs `ByteTrackWrapper`. **This, not `TRACKER_TYPE`, is what selects the production tracker.** argparse default is `"bytetrack"`. | `bytetrack` | n/a | n/a |
| `RegionManager.STALE_ID_FRAMES` | line_counter.py:423 | int class attr | **Frames** an id may be unseen before eviction from `session_counted_ids` / history. **Hardcoded 300 in the class**, NOT read from settings. | 300 | `counting.stale_id_frames: 300` (tuning.yaml:60) — **declared but never read by the code** (see §7) | 300 |
| `scorer.*` (passthrough, thresholds, weights, vetoes) | `settings.SCORER_CONFIG` = `_TUNING["scorer"]` (settings.py:349) | dict | Fused logistic model; `passthrough: false` on the fleet means the scorer **actively gates** confirm/flag/drop (tuning.yaml:85, and settings.py:346-348 says the same). `threshold_confirmed: 0.65`, `threshold_flagged: 0.45` (tuning.yaml:83-84). | passthrough ON in code | passthrough **OFF** | n/a |
| `heal.*`, `birth_inference.*`, `identity_firewall.*` | `tuning.yaml` groups, consumed via `build_healer(config, …)` (track_healer.py:418) etc. | dict | All three shipped **enabled: true** per the header block at tuning.yaml:17-26. | disabled in code | enabled | n/a |
| `detection.classes` / CLI `--classes` | argparse default `"1"` (sack_detector.py:486); **compose passes `--classes 0,1`** (`EDGEROOT/docker-compose.yml:13`) | str | Model class ids kept by the backend. Person (0) is split off before the tracker (detection_loop.py:1653-1656), so it never enters the count. | `"1"` | `detection.classes: "0,1"` (tuning.yaml:33) | n/a |

### Repo defaults are NOT proof of what is deployed

Stated explicitly, as required.
Everything in the two right-hand columns above is **this git checkout**, resolved on this Mac from `EDGE/config/tuning.yaml` plus `EDGEROOT/.env` (which sets **no** counting knob — verified: the keys in `.env` are HAILO/DEVICE/MQTT/RTSP/WEATHER only).
A running container is the authority.
Three specific reasons this checkout can differ from a device:

1. `EDGEROOT/docker-compose.yml:57` bind-mounts `./detector/config/tuning.yaml` into `/app/config/tuning.yaml` — so whatever file is on the device's disk wins, not what git says here.
2. Every knob above is ENV-overridable at higher precedence than the yaml (settings.py:97-101), and compose injects env from the device's own `.env`.
3. The repo is currently on branch `fix/boxmot-tracker-import`, not a release tag (`git branch --show-current` in `EDGEROOT`).

The device-side way to check is the boot audit log: `settings.log_config_sources()` (settings.py:111-129) prints `NAME = value  [env|yaml|default]` for every knob routed through `resolve_tunable`.
`COUNT_HYSTERESIS_CP_MIN` and `TRACKER_TYPE` are **not** in that audit — they use bare `os.getenv` (settings.py:275, :318) — so those two have to be read some other way on-device.

---

## 5. Python version and dependency floor

### What the edge stack declares

- **Python 3.11** — `EDGE/Dockerfile:10` and `:76` both `FROM python:3.11-slim-bookworm`.
- `EDGE/requirements.txt` (11 lines, read in full): `opencv-python`, `numpy<2.0.0`, `paho-mqtt`, `shapely>=2.0.0`, `boxmot`, `psutil`, `requests`, `scipy>=1.13.0`, `lap`, `av==12.3.0`, `pyyaml>=6.0`.

### What the counting core actually needs

Not all of that.
The core's transitive imports are only: `numpy`, `scipy` (kalman_filter.py:12), `lap` (matching.py:8), `cv2` (line_counter.py:9, roi_config.py:8), `pyyaml` (settings.py:44), stdlib.
`paho-mqtt`, `shapely`, `boxmot`, `psutil`, `requests`, `av` are glue-only.

Syntax floor of the core, measured by scanning all 15 core files for `match` statements, `X | Y` annotations and builtin generics: **the only modern-syntax hit in the whole set is `settings.py:111 `def log_config_sources(logger=None) -> list[str]:`** — a PEP 585 builtin generic, so **Python ≥ 3.9**.
Every counting/tracking module itself uses `Optional[...]`/`Dict[...]` typing style and would run on 3.8.

### What sack-train-ml declares

`LAB/pyproject.toml`:
- `requires-python = ">=3.10"` (:9)
- deps: `pyyaml>=6.0`, `ultralytics==8.4.138` (pinned, :16), `onnx>=1.16.0`, `onnxsim>=0.4.36`, `numpy>=1.26` (:11-19)
- `target-version = "py310"` (:36)

There is **no requirements.txt anywhere in the lab repo** and **none in `LAB/webui/`** — `lab_core.py` imports `cv2`, `numpy`, `ultralytics` behind a try/except ModuleNotFoundError guard (lab_core.py:20-25) and those three are not all in pyproject (`opencv-python` is absent entirely).

### Named conflicts

1. **`numpy<2.0.0` (edge requirements.txt:2) vs `numpy>=1.26` (LAB pyproject.toml:19).** These are not incompatible on paper — `>=1.26` admits 1.26.x — but they *pull in opposite directions*: the lab's ultralytics pin will resolve numpy to 2.x on a fresh install, and a shared package that inherits the edge pin caps the lab at 1.x. **Measured**: the counting core runs correctly under **numpy 2.4.5** (§7), so the `<2.0.0` pin is a constraint of something else in the edge image, not of the counting stack. Whatever needs it should be identified before the pin is copied into a shared package.
2. **`scipy`, `lap`, `opencv-python` are absent from `LAB/pyproject.toml`.** ByteTrack cannot run without `scipy.linalg` and `lap`; `LineRegion`'s exclusion zones cannot run without `cv2`. Lifting the stack **adds three dependencies to sack-train-ml**. `lap` in particular is a C-extension with a history of wheel gaps.
3. **Python floor**: edge builds on 3.11, lab declares ≥3.10, core code needs ≥3.9. A shared package can safely declare `>=3.10` (the stricter of the two consumers). No conflict — this one is free.
4. **Not a conflict but a hazard**: the lab pins `ultralytics==8.4.138` exactly, with a comment explaining why (pyproject.toml:12-16). A shared counting package must not depend on ultralytics at all, or it drags that pin onto the device image.

---

## 6. Verdict and the minimal interface

### Verdict: **lifts behind a defined backend interface.**

Not "lifts cleanly" — three things have to be dealt with, all of them small and all of them named below.
Not "entangled" — the entangled parts (MQTT, SQLite, camera, Hailo) sit *above* the counting stack in `detection_loop.py`, not inside it, and cv-replay already demonstrated stepping around them.

**The interface already exists and is already implemented twice in the edge repo.**

```
backend.infer(frame_bgr: np.ndarray[H,W,3]) -> (boxes, classes, confs)
    boxes   : list[list[int]]   # [x1, y1, x2, y2], pixel coords in the ORIGINAL frame
    classes : list[int]         # model class ids (0=person, 1=sack)
    confs   : list[float]       # 0-1
backend.close() -> None
backend.name    : str
```

This is stated verbatim as the contract in `run_detection`'s docstring (detection_loop.py:669-672), and implemented by:

- `HailoBackend` — `EDGE/src/detector/hailo_backend.py:362`, `infer` at :390, `name = "hailo"` at :388, `close` at :477.
- **`UltralyticsBackend` — `EDGE/src/detector/ultralytics_backend.py:20`, `infer` at :43, `name = "ultralytics"` at :41, `close` at :71.** A `.pt` backend with the identical signature **already ships in the edge repo** and is not referenced by `_create_backend` (sack_detector.py:2450-2468, which hardcodes Hailo). It appears to be dead code waiting for exactly this use.
- `PtBackend` — `SKILL/_cv_lib/backend.py:19`, same contract restated at :11, with `make_backend(kind, …)` at :44 refusing `hef` off-device at :50-53.

So there are **three** implementations of one interface already written, in two repos, and nothing consumes them polymorphically.

### The minimal lift, concretely

Package surface, in dependency order:

```
counting/
  byte_tracker/{basetrack,kalman_filter,matching,byte_tracker}.py   # verbatim, pure
  tracker.py            # ByteTrackWrapper only; drop BoxmotTracker (experiment-only, tracker.py:19)
  roi_config.py         # CountEvent, BaseRegion, dedup
  line_counter.py       # LineRegion, RegionManager
  detection_split.py    # keep_class_for_count, split_sack_person
  crossing_scorer.py    # verdict model
  scorer_features.py
  track_healer.py + motion_predictor.py
  birth_crossing_inference.py
  identity_firewall.py
  config.py             # NEW: replaces `from src.config import settings`
  pipeline.py           # NEW: the ~70 lines currently inline at detection_loop.py:1908-2019
backends/
  protocol.py           # the 3-member contract above
```

Three changes required, and only three:

1. **Replace the `settings` module-attribute reads with an injected config object.** Four call sites, all late-bound already: line_counter.py:196-199, :315, :323 and roi_config.py:113-114. `ByteTrackWrapper` needs none — it already takes all three knobs as constructor args (tracker.py:173-182). The device would build that config from `tuning.yaml`; the lab from `LabConfig`. **Do not carry `settings.py` itself across** — it reads `.env`, calls `gethostname()`, and mkdirs at import (settings.py:15-31, :144).
2. **Extract the confirm/flag/drop block from `run_detection` into `pipeline.py`.** Source: detection_loop.py:1908-2019 (verdict, count_number assignment, net_count, revert-on-flag). Without this, the lab and the device still make the split differently — which is exactly today's bug: cv_replay.py:190 hand-rolls `ev.confidence >= CONF` (passthrough), while the fleet runs `passthrough: false` (tuning.yaml:85) and gates through the scorer with vetoes. **cv-replay is therefore NOT deploy-truth on the confirm/flag split today, despite its SKILL.md calling itself "deploy-truth".**
3. **Add `scipy`, `lap`, `opencv-python` to the lab's dependency set** (§5).

`RegionManager.STALE_ID_FRAMES` (line_counter.py:423) should become part of the injected config in the same pass — `tuning.yaml:60` already declares `counting.stale_id_frames: 300` as if it were configurable, and it is not (§7).

### What the Lab loses / must abandon

`LAB/webui/lab_core.py` has no salvageable counting code once this lands:
- `CentroidTracker` (lab_core.py:346) — greedy nearest-centroid, deleted in favour of real ByteTrack.
- `match_distance = max(roi_dedup_px, 50.0 * (1 - match_thresh))` (lab_core.py:518) — this is the reported unit bug and it is worse than described: it does not just convert an IoU threshold to pixels, it takes `max()` with `roi_dedup_px`, so with the shipped values (`match_thresh=0.70`, `roi_dedup_px=25`) the term `50*(1-0.70)=15` is **entirely dominated by 25 and has no effect at all**. The knob the UI labels "Match threshold" is inert across most of its range. Any Lab result tuned on that slider was tuning nothing.
- `side_of_line` (:160) / `derive_crossing_event` (:245) — replaced by `LineRegion.update`.
- `LabConfig` (lab_core.py:48-79) survives as the *config source*, mapped onto the injected config object. It already carries the right values: `roi_dedup_px=25` (:68), `roi_dedup_frames=120` (:69), `count_cooldown_frames=40` (:70), `conf_split=0.60` (:67) — all matching `tuning.yaml`. Its comment at :50 ("Defaults = deployed sack-detector-edge (.env)") is misattributed: those numbers come from `tuning.yaml`, not `.env`, which sets none of them.

---

## 7. Surprising things found, unasked

**a) The whole stack already runs on a Mac, on Python 3.14 and numpy 2.**
Executed during this investigation, read-only, with `PYTHONDONTWRITEBYTECODE=1` and `python -B`, using `EDGEROOT/.venv/bin/python`:

```
numpy 2.4.5 | cv2 4.13.0 | scipy 1.18.0   (Python 3.14.5)
ByteTrackWrapper() + RegionManager(None,640,640) + update_from_config([line]),
12 synthetic frames of one box crossing x=320
-> END-TO-END OK, count events = 1 | in=1 out=0
```

No Hailo, no picamera2, no MQTT, no SQLite. This is the single strongest piece of evidence for the verdict.
It also means the edge repo's `numpy<2.0.0` pin (requirements.txt:2) does **not** come from the counting stack.

**b) A `.pt` backend already exists in the edge repo and nothing calls it.**
`EDGE/src/detector/ultralytics_backend.py` implements the exact `infer` contract (:43-69). A scan of every `.py` in `EDGE` for `UltralyticsBackend` / `ultralytics_backend` returns exactly two hits: its own class definition (ultralytics_backend.py:20) and a passing mention in a comment (model_loader.py:882). **Nothing imports or constructs it** — `_create_backend` hardcodes Hailo (sack_detector.py:2461).
The "one engine, two backends" decision is half-built already.

**c) `TRACKER_TYPE` is dead on the deployed path.**
`docker-compose.yml:44` sets `TRACKER_TYPE=${TRACKER_TYPE:-botsort}` and `settings.py:275` reads it — but it is consumed only by `BoxmotTracker` (tracker.py:125-126), and the compose command (`docker-compose.yml:13`) passes no `--tracker-mode`, so argparse's default `"bytetrack"` (sack_detector.py:497) selects `ByteTrackWrapper` (detection_loop.py:837-838). The env var that *looks* like the tracker selector is inert. `tracker.py:19-20` says as much: "EXPERIMENT PATH ONLY — production runs ByteTrackWrapper".

**d) Three tuning.yaml knobs are dead, in two different ways, and the file claims to be the single source of truth (tuning.yaml:17).**

- `counting.stale_id_frames: 300` (tuning.yaml:60) is **never loaded at all**. `RegionManager.STALE_ID_FRAMES = 300` is a hardcoded class attribute (line_counter.py:423, used at :700, :705, :720). A scan of every `.py` under `EDGE/src` for `stale_id`/`STALE_ID` finds it only in line_counter.py and in prose comments (settings.py:300, :307; track_healer.py:173; birth_crossing_inference.py:417, :444) — there is no `resolve_tunable` entry for it anywhere. Editing that yaml line on a device changes nothing.
- `predictor.mode` and `predictor.history_n` (tuning.yaml:109-110) **are** loaded — `settings.PREDICTOR_MODE` / `PREDICTOR_HISTORY_N` at settings.py:441-442 — but a scan of every `.py` under `EDGE/src` finds those two names **nowhere except their own definition**. Nothing consumes them. settings.py:434-440 explains why: `motion_predictor` is deliberately settings-free and carries its own mirrored defaults (motion_predictor.py:25, :35, :133), and "SP-4 threads PREDICTOR_MODE / PREDICTOR_HISTORY_N through explicitly when it wires the occlusion healer" — that threading never happened. `build_healer` (track_healer.py:418-444) reads the `heal` group only and passes no predictor config. So the healer runs on `motion_predictor`'s hardcoded defaults regardless of what tuning.yaml says.

**e) cv-replay's SKILL.md is stale in two specific, load-bearing ways** (detailed in §3): a `--backend pt` flag that does not exist, and baked-param numbers (ROI-dedup 300/50, match 0.8) that are settings.py code defaults the shipped `tuning.yaml` overrides to 25/120 and 0.7. Anyone reading the skill doc to reproduce a count gets the wrong dedup radius by a factor of two.

**f) cv-replay is not deploy-truth on the confirmed/flagged split.**
It reimplements passthrough (`ev.confidence >= CONF`, cv_replay.py:190) while the fleet runs `scorer.passthrough: false` with hard vetoes (tuning.yaml:85, detection_loop.py:1936-1985). Its confirmed count and the device's can legitimately differ on the same footage for that reason alone, independent of frame timing. The clip caveat in SKILL.md ("this is an AUDIT, not a bit-exact reproduction") covers frame duplication but not this.

**g) `ByteTrackWrapper.update` re-derives the class id by IoU argmax.**
ByteTrack itself discards class ids, so the wrapper re-attaches them by picking, per output track, the input detection with the highest IoU (tracker.py:256-276). It notes that two tracks can independently claim one detection and deliberately does not resolve it, counting instead (`duplicate_det_index_total`, tracker.py:296-306). This is a real structural quirk any lifted package inherits.

**h) `LineRegion.update` increments the count *before* the verdict exists**, and `detection_loop` reverts it for flagged events (line_counter.py:337-340, then detection_loop.py:2017-2019). So `region.in_count` is transiently wrong every frame a flagged crossing occurs. cv_replay.py:196-201 reproduces this revert by hand, and its own comment (cv_replay.py:224-231) admits the per-region `in_count` is unreliable for the headline number and that it uses `total_crossing_seq` instead. A lifted package should emit an undecided event and let the pipeline decide — increment-then-revert is a landmine for any second consumer.

---

## Suspected, unverified

Listed separately because I could not evidence them from a file I opened.

- **What actually requires `numpy<2.0.0`** in `EDGE/requirements.txt:2`. Candidates by elimination are `boxmot`, `av==12.3.0`, or the hailo_platform wheel, but I did not open any of their metadata. Do not assume it is safe to drop.
- **Whether the deployed devices' `tuning.yaml` matches this checkout.** Everything in §4's right-hand columns is this git worktree resolved on this Mac. Per `verify-deployed-config-from-device`, the device is the authority and must be read via `docker inspect` / `docker exec`, or from the boot lines emitted by `settings.log_config_sources` (settings.py:111-129).
- **Whether `lap` has wheels for Python 3.10-3.14 on macOS arm64.** It imported successfully in `EDGEROOT/.venv` on 3.14.5, so at least one working install exists on this machine — but I did not check how it got there or whether `pip install lap` reproduces it.
- **`shapely`, `psutil`, `requests`, `av`, `paho-mqtt` being glue-only.** I traced the counting core's imports and none of these appear; I did not exhaustively grep the whole `src/` tree for them.

---

# Verification pass — corrections (2026-09-07)

An adversarial reviewer opened ~45 of this document's citations and independently
reproduced §7a's off-device run (`events 1 regions in/out [(1, 0)]`, edge `.venv`,
Python 3.14.5 / numpy 2.4.5 / cv2 4.13.0 / scipy 1.18.0). **Verdict:
usable-with-caveats.** The edge-repo half is well-evidenced and every citation checked
there was correct at the stated line, so the *"lifts behind a backend interface"*
verdict stands on evidence. What follows is what did not survive.

## §3 was written from memory, not from the file — every line number in it is wrong

`SKILL/cv-replay/cv_replay.py` is **296 lines, not 250**, and has not changed since
2026-08-31. Corrected:

| Claimed | Actual |
|---|---|
| imports `:35-38` | `:31-34` |
| `HailoBackend(...)` `:113` | `:104` |
| `ByteTrackWrapper(...)` `:114` | `:105` |
| `RegionManager(None, W, H)` `:116` | `:107` |
| `if ev.confidence >= CONF` `:190` | **`:199`** |
| argparse `:40-96` | `:36-84` |
| by-hand revert `:196-201` | `:212-218` (the decrement itself at `:215`) |
| `in_count` unreliability comment `:224-231` | `:263-268` |
| `from track_healer import TrackHealer` `:22` | `:23` (`:22` is `import trails as T`) |

**The substance survives; the citations did not.** The load-bearing claim — cv-replay
hand-rolls passthrough while the fleet gates through `CrossingScorer` — is true of the
code. Quote it from `:199`.

Also missed in §3: the file's one genuine stub, the fail-closed provenance-gate import
at `cv_replay.py:19-28` (`_HAVE_GATE`, `T = None`, `TrackHealer = None`).

## Four claims that contradict their own sources

1. **`publish_detection_count` is not called only from `detection_loop`.** It is also
   imported at `sack_detector.py:37` and called at `sack_detector.py:761`.
2. **`crossing_scorer.from_settings()` does not lazily import settings — the meaning was
   inverted.** `crossing_scorer.py:351` is
   `def from_settings(cls, settings, contributor_fns=None, veto_fns=None)`: settings is a
   **parameter injected by the caller**, and the body only `getattr`s it. The module
   docstring says "imported lazily *by the caller*".
3. **"Nothing consumes the backends polymorphically" contradicts the citation two lines
   above it.** `run_detection(args, context, backend, camera_service)`
   (`detection_loop.py:667`) takes the backend as a parameter and documents the contract at
   `:669-672` — it *is* written polymorphically and is only ever handed one implementation.
   The defect is in `_create_backend` (`sack_detector.py:2461-2468`), not in the consumer.
4. **The settings-read enumeration is incomplete.** `line_counter.py` also reads
   `settings.REVERSE_DIRECTION_WARNING_WINDOW_S` and `_MIN_EVENTS` at `:346-347`. So
   "three changes required, and only three" rests on a list that was not exhaustive — the
   shape of the lift is unchanged, the count is not.

## The Lab environment was never opened, and it changes the dependency conclusion

`sack-train-ml/.venv` runs **Python 3.14.5 with scipy 1.17.1, lap 0.5.13,
opencv-python 4.10.0, numpy 2.4.6 — and ultralytics 8.4.56.** Verified directly.

Two consequences:

- **§5's "add scipy, lap, opencv-python" is wrong as stated.** They are already installed,
  transitively. What is true, and still worth doing, is that `pyproject.toml` **declares**
  none of them (it names `ultralytics==8.4.138` and nothing else in that family), so the
  counting package would be relying on a transitive dependency — which is how an
  environment breaks silently later. The action is *declare*, not *install*.
- **The installed ultralytics is not the pinned one.** `check_toolchain_pin()` returns
  `ultralytics 8.4.56 installed, contract pins 8.4.138`. `tests/test_contract.py:65-71`
  deliberately downgrades this to a `warnings.warn` and explains itself honestly — a green
  tick should not imply more than it earned. So this is not a bug in the test. It is a
  **v1.0.0 acceptance gap**: `check_against_ultralytics()` currently proves the schema
  matches 8.4.56, and the pin exists precisely because the Muon defect lived in exactly one
  upstream release. A release gate must require the pinned version present.

## Two asked-for answers are missing

- **Deployed knob values, read from a running container.** The ticket named this as the
  authority and warned the repo has been burned by trusting a checkout. §4's values are
  this Mac's worktree only. The `edge-device-ssh` / `docker inspect` route was available
  and not taken. Everything in §4 is therefore a claim about the deployment, not proof of it.
- **Whether the flagged-item ledger lifts.** `RegionManager`'s flagged ledger
  (`line_counter.py:748-993`) is placed inside the CORE and carried verbatim in §6's
  package listing, but it is MQTT/journal-shaped device bookkeeping (`flag_event`,
  `flagged_id`, `session_id`). It is classified nowhere in §2 and addressed nowhere in the
  lift plan. **Open question, and it is on the critical path** — a package that drags a
  session/MQTT ledger into the Lab has not actually separated the layers.
