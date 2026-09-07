# 01 — What does the device's counting stack actually depend on, and can it be lifted out?

Type: research
Status: resolved
Blocked by: —

## Question

The map settled that **one counting engine** serves both the Lab and the device
(ByteTrack + the real `LineRegion`, differing only in detection backend). Everything else
on this map assumes that lift is possible. Before any design depends on it, establish
whether it is.

Find out, from the source in `~/Work/BSCP/sack-detector-edge`:

- **Which modules constitute the counting stack** — the tracker, the line/region geometry,
  the crossing decision, dedup, cooldown, and whatever emits a count event. Name each with
  its path.
- **What each one imports.** The question that decides everything: does the counting logic
  reach into `hailo_platform`, `picamera2`, MQTT, SQLite, or device config — or does it
  take detections in and emit events out? A module that only touches numpy and dataclasses
  lifts cleanly; one that constructs a `HailoBackend` internally does not.
- **Where the seam already is.** `cv-replay` (in `loom-oracle/.claude/skills/cv-replay/`)
  already runs this stack over a file instead of a camera, inside the container, importing
  `src.detector.hailo_backend`. That existing split is evidence about where a backend
  boundary can go — read `cv_replay.py` and record what it had to stub or supply.
- **What the tunable knobs actually are, with their real units** — `BYTETRACK_MATCH_THRESH`
  and friends, where they are read from, and their defaults *as deployed* (the running
  container is the authority, not the Mac checkout or git — this repo has been burned by
  that before).
- **Python version and dependency floor** the stack needs, versus what the Lab's
  environment has.

Deliverable: a written inventory naming every module, its imports, its knobs with units,
and a verdict — *lifts cleanly* / *lifts with a defined backend interface* / *entangled,
and here is what entangles it*. No code changes; this ticket only establishes facts.

Blocks [05](./05-where-the-shared-engine-lives.md), which decides how the thing is packaged
once we know what it is.

## Answer

**Verdict: it lifts behind a defined backend interface — and the interface already exists,
implemented three times.** Full inventory, with `path:line` for every claim:
[`research/01-edge-counting-inventory.md`](../research/01-edge-counting-inventory.md).

This was not established by reading. The whole counting stack was **executed off-device**
during the investigation — `EDGEROOT/.venv/bin/python`, Python 3.14.5, numpy 2.4.5, cv2
4.13.0, scipy 1.18.0, no Hailo, no picamera2, no MQTT, no SQLite — running
`ByteTrackWrapper()` + `RegionManager` over twelve synthetic frames of a box crossing
x=320, and it emitted `count events = 1 | in=1 out=0`.

The stack splits into a **core** that lifts and a **glue layer** that does not and should
not: MQTT, the SQLite journal, the camera service and the Hailo backend all sit *above* the
counting logic in `detection_loop.py`, never inside it.

Three changes are required and only three — inject config instead of importing `settings`
(four late-bound call sites), extract the confirm/flag/drop verdict out of `run_detection`
(`detection_loop.py:1908-2019`), and add `scipy` / `lap` / `opencv-python` to the Lab's
dependencies. Packaging and ownership are decided in
[05](./05-where-the-shared-engine-lives.md).

**Five findings that were not asked for and that change what gets built:**

1. `UltralyticsBackend` (`ultralytics_backend.py:20`) is a working `.pt` backend already in
   the edge repo implementing the exact contract, and **nothing imports it** —
   `_create_backend` hardcodes Hailo (`sack_detector.py:2461`).
2. **`cv-replay` is not deploy-truth on the confirm/flag split**, despite its `SKILL.md`
   claiming to be. It hand-rolls passthrough (`cv_replay.py:190`) while the fleet runs
   `scorer.passthrough: false` with hard vetoes.
3. **`TRACKER_TYPE` is inert on the deployed path.** `docker-compose.yml:44` sets it and
   `settings.py:275` reads it, but only `BoxmotTracker` consumes it, and the compose command
   passes no `--tracker-mode`, so argparse's default selects `ByteTrackWrapper`.
4. **Three `tuning.yaml` knobs are dead** while the file declares itself the single source of
   truth (`tuning.yaml:17`). `counting.stale_id_frames` is never loaded at all —
   `RegionManager.STALE_ID_FRAMES` is a hardcoded class attribute. `predictor.mode` and
   `predictor.history_n` are loaded into settings and consumed by nothing; the healer runs on
   `motion_predictor`'s own hardcoded defaults regardless.
5. **`LineRegion.update` increments the count before the verdict exists** and the loop
   reverts it for flagged events, so `region.in_count` is transiently wrong on every flagged
   crossing. A lifted package must emit an *undecided* event instead.

Items 3 and 4 are dead controls in the deployed device, not in the Lab. They are outside this
map's destination, so they are recorded here and belong to whoever owns the edge repo — flagged,
not fixed.
