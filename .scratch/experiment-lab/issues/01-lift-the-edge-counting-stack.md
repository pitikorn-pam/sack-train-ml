# 01 — What does the device's counting stack actually depend on, and can it be lifted out?

Type: research
Status: open
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
