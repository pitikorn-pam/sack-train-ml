# 05 — Where does the shared counting engine live, and how is it packaged?

Type: grilling
Status: resolved
Blocked by: 01

## Question

Decided already: the Lab and the device count with **the same engine**, and the Lab's
centroid tracker (`webui/lab_core.py:61`) is retired rather than kept as a second mode.
Undecided: where that engine physically lives, who owns it, and how three consumers get it.

The consumers are the Mac (`.pt` via ultralytics, `device=mps`), a Pi + Hailo-8L (`.hef` via
`HailoBackend`), and the existing `cv-*` CLI skills in `loom-oracle`. The candidates:

- **Stays in `sack-detector-edge`**, imported by the others. Matches `AGENTS.md`, which says
  this repo does not own edge runtime code — but it makes `sack-train-ml` depend on a repo it
  does not control, and the Lab's release cadence is not the device's.
- **Extracted to its own package**, depended on by both. Honest about the shared ownership;
  costs a third repo, a versioning story, and a release step on the critical path of edge
  deploys.
- **Vendored into `sack-train-ml`**, with the device importing it back. Inverts the current
  ownership rule and needs that rule renegotiated.
- **Copied.** Cheapest today, and it recreates exactly the divergence this map exists to fix
  — the current mess is two copies of counting logic that drifted apart.

Whatever wins must answer:

- **The backend interface.** [01](./01-lift-the-edge-counting-stack.md) reports where the
  seam can go. Settle its shape: what a detection backend must provide so `.pt` and `.hef`
  are interchangeable, and what the engine is allowed to assume about the frames it gets.
- **Config, in one vocabulary.** Today the Lab's "Match threshold" means pixels and the
  device's means IoU. One schema, one set of units, one set of defaults — extending the
  `contracts/param-schema.json` pattern (one JSON, three readers) rather than inventing a
  second mechanism.
- **Which defaults are authoritative**, given that POC parameters and deployed runtime
  values are known to differ (conf 0.60 vs 0.70, dedup 120/25 vs 300/50), and that the
  *running container* is the authority on what is deployed.
- **What proves the two paths agree.** A test that runs one clip through the Mac path and
  the device path and asserts the events match — otherwise "one engine" is a claim, and this
  map has already retracted one of those.

Blocks [07](./07-portable-hef-runner.md) and [09](./09-where-the-lab-runs.md).

## Answer

*(Taken on the recommendations, under the owner's directive to keep moving. Grounded in
[the counting-stack inventory](../research/01-edge-counting-inventory.md), which did not
merely read the code — it **executed** the whole counting stack off-device on Python 3.14.5
with numpy 2.4.5, no Hailo, no picamera2, no MQTT, no SQLite, and got a real crossing count
out of it.)*

**`sack-detector-edge` keeps ownership. The counting core becomes an installable package
inside it, and `sack-train-ml` depends on it by pinned git ref.**

The four candidates, and why this one:

| Candidate | Verdict |
|---|---|
| Stays in the edge repo, imported by both | **Chosen.** It is where the code already is, where it is tested against real hardware, and where `AGENTS.md` puts ownership. A pinned ref buys the cadence independence that was the only real objection. |
| Its own third repo | Rejected. Ten files do not justify a repo, a release story, and a publish step on the critical path of every edge deploy. |
| Vendored into `sack-train-ml` | Rejected. Inverts the ownership rule in `AGENTS.md`, and puts runtime code in the repo least able to test it. |
| Copied | Rejected outright. Two copies of counting logic that drifted apart **is the present bug**. |

Pinning is what makes this work: the Lab installs
`sack-counting @ git+ssh://…/sack-detector-edge@<tag>` and upgrades deliberately, so the
device's release cadence never drags the Lab. That pinned ref *is* the value that goes into
`evaluations.engine_version` — the column stops being a promise and becomes a coordinate.

### The interface: already written, three times, consumed polymorphically zero times

```
backend.infer(frame_bgr: np.ndarray[H,W,3]) -> (boxes, classes, confs)
    boxes   : list[list[int]]   # [x1,y1,x2,y2] in ORIGINAL frame pixels
    classes : list[int]         # 0 = person, 1 = sack
    confs   : list[float]       # 0..1
backend.close() -> None
backend.name    : str
```

Stated verbatim as the contract in `run_detection`'s docstring
(`detection_loop.py:669-672`) and implemented by `HailoBackend` (`hailo_backend.py:362`),
`UltralyticsBackend` (`ultralytics_backend.py:20`) and `_cv_lib/backend.py:19` in the skills
bundle. **`UltralyticsBackend` is a working `.pt` backend that already ships in the edge repo
and that nothing imports** — `_create_backend` hardcodes Hailo at `sack_detector.py:2461`.
The "one engine, two backends" decision is half-built already; this ticket mostly connects
what exists.

### The lift, and the three changes it needs

```
counting/
  byte_tracker/{basetrack,kalman_filter,matching,byte_tracker}.py   # verbatim, pure
  tracker.py           # ByteTrackWrapper only — BoxmotTracker is experiment-only (tracker.py:19)
  roi_config.py        # CountEvent, BaseRegion, dedup
  line_counter.py      # LineRegion, RegionManager
  detection_split.py   # keep_class_for_count, split_sack_person
  crossing_scorer.py + scorer_features.py
  track_healer.py + motion_predictor.py
  birth_crossing_inference.py + identity_firewall.py
  config.py            # NEW — replaces `from src.config import settings`
  pipeline.py          # NEW — the verdict block currently inline in run_detection
backends/protocol.py   # the three-member contract above
```

1. **Inject config instead of importing `settings`.** Four call sites, all late-bound
   already: `line_counter.py:196-199, :315, :323` and `roi_config.py:113-114`.
   `ByteTrackWrapper` needs nothing — it already takes its knobs as constructor arguments
   (`tracker.py:173-182`). `settings.py` itself must **not** cross: it reads `.env`, calls
   `gethostname()` and creates directories at import time (`settings.py:15-31, :144`).
   `RegionManager.STALE_ID_FRAMES` (`line_counter.py:423`) joins the injected config in the
   same pass — `tuning.yaml:60` already advertises it as tunable and it is not.

2. **Extract the confirm / flag / drop verdict out of `run_detection`.** Source:
   `detection_loop.py:1908-2019` — the verdict, the count-number assignment, the net count,
   and the revert-on-flag. This is the change that actually matters, because without it the
   two sides still make the split differently. See the correction below.

3. **Add `scipy`, `lap`, `opencv-python` to the Lab's dependency set.** The edge repo's
   `numpy<2.0.0` pin does **not** come from the counting stack — it ran fine on numpy 2.4.5 —
   so it does not travel with the package. What actually requires that pin is still unknown
   and is on the unverified list; do not drop it on the device on this evidence.

### A correction this ticket forces, and it is not small

**`cv-replay` is not deploy-truth on the confirm/flag split, despite its own `SKILL.md`
saying so.** It hand-rolls passthrough — `ev.confidence >= CONF` at `cv_replay.py:190` —
while the fleet runs `scorer.passthrough: false` (`tuning.yaml:85`) and gates every crossing
through `CrossingScorer` with hard vetoes (`detection_loop.py:1936-1985`). Its confirmed
count and the device's can differ on identical footage for that reason alone, with no frame
timing involved. The skill's caveat covers frame duplication, not this.

Two consequences. Any past comparison that treated a `cv-replay` confirmed count as the
device's number carries an unquantified error. And once `pipeline.py` exists, `cv-replay`
must be rewired to call it, which is what finally makes the skill's own claim true.

Two more staleness bugs in that skill, both load-bearing: it documents a `--backend pt` flag
that does not exist, and it prints baked parameters (ROI dedup 300/50, match 0.8) that are
`settings.py` code defaults which the shipped `tuning.yaml` overrides to 120/25 and 0.7 —
so anyone reproducing a count from the doc gets the dedup radius wrong by a factor of two.

### Config, in one vocabulary, with units that mean what they say

The counting config joins the existing contract pattern — one JSON schema, read by the web
form, the edge function and Python — rather than inventing a second mechanism.
Non-negotiable in that schema: **`match_thresh` is an IoU threshold.** It is what ByteTrack
means by it, it is what the device means by it, and the measured −18% id-churn result was
obtained on that meaning.

The Lab's current conversion is not merely wrong about units, it is inert:

```python
match_distance = max(roi_dedup_px, 50.0 * (1 - match_thresh))   # lab_core.py:518
```

With the shipped values (`match_thresh = 0.70`, `roi_dedup_px = 25`) the second term is
`15`, which `max` discards. **The slider labelled "Match threshold" changes nothing at all
until it is dragged below 0.5.** Any Lab result tuned on that control was tuning nothing —
which retires the "keep centroid as a fast mode" option more decisively than the earlier
argument did.

**Authoritative defaults**: the package ships defaults mirroring `tuning.yaml`, and the
*running container* remains the authority on what is deployed (`docker inspect` /
`docker exec`, or the boot lines from `settings.log_config_sources`, `settings.py:111-129`).
A repo file is a claim about the deployment, never proof of it. `LabConfig`
(`lab_core.py:48-79`) survives as a config source and already carries the right numbers; its
comment attributing them to `.env` is wrong — they come from `tuning.yaml`, which is what
this ticket makes explicit.

### What proves the two paths agree

Three tests, and the package does not ship without them:

1. **Golden-event parity.** One clip, one config, run through the package on a Mac with
   `UltralyticsBackend` and through the device path; assert the emitted crossing events match
   frame-for-frame and id-for-id. Until this passes, "one engine" is a claim, and this map
   has already had to retract one of those.
2. **A unit test per lifted module**, at minimum covering `LineRegion.update`,
   the dedup path in `roi_config`, `CrossingScorer.classify` in both passthrough and fused
   modes, and `ByteTrackWrapper.update`'s IoU-argmax class re-attachment
   (`tracker.py:256-276`), which can let two tracks claim one detection and deliberately does
   not resolve it.
3. **A regression test for the increment-then-revert landmine.** `LineRegion.update`
   increments the count *before* the verdict exists (`line_counter.py:337-340`) and the loop
   reverts it for flagged events (`detection_loop.py:2017-2019`), so `region.in_count` is
   transiently wrong on every flagged crossing. `pipeline.py` must emit an **undecided**
   event and let the caller decide, and the test must pin that behaviour — an increment a
   second consumer can observe mid-flight is exactly how a wrong number gets published.
