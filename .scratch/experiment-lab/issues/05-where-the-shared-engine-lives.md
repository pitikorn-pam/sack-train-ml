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

1. **Inject config instead of importing `settings`.** Five call sites, all late-bound
   already: `line_counter.py:196-199, :315, :323, :346-347` and `roi_config.py:113-114`.
   (An earlier draft said four and missed `REVERSE_DIRECTION_WARNING_WINDOW_S` / `_MIN_EVENTS`
   at `:346-347`; the shape of the change is unaltered, the count was wrong.)
   `ByteTrackWrapper` needs nothing — it already takes its knobs as constructor arguments
   (`tracker.py:173-182`). `settings.py` itself must **not** cross: it reads `.env`, calls
   `gethostname()` and creates directories at import time (`settings.py:15-31, :144`).
   `RegionManager.STALE_ID_FRAMES` (`line_counter.py:423`) joins the injected config in the
   same pass — `tuning.yaml:60` already advertises it as tunable and it is not.

2. **Extract the confirm / flag / drop verdict out of `run_detection`.** Source:
   `detection_loop.py:1908-2019` — the verdict, the count-number assignment, the net count,
   and the revert-on-flag. This is the change that actually matters, because without it the
   two sides still make the split differently. See the correction below.

3. **Declare `scipy`, `lap`, `opencv-python` in `pyproject.toml`.** They are already
   *installed* in the Lab venv transitively (scipy 1.17.1, lap 0.5.13, opencv 4.10.0 —
   verified directly), so this is not an install step. It is a declaration step, and it
   matters because relying on a transitive dependency is how an environment breaks silently. The edge repo's
   `numpy<2.0.0` pin does **not** come from the counting stack — it ran fine on numpy 2.4.5 —
   so it does not travel with the package. What actually requires that pin is still unknown
   and is on the unverified list; do not drop it on the device on this evidence.

### A correction this ticket forces, and it is not small

**`cv-replay` is not deploy-truth on the confirm/flag split, despite its own `SKILL.md`
saying so.** It hand-rolls passthrough — `ev.confidence >= CONF` at `cv_replay.py:199` —
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

---

## Corrections after adversarial verification (2026-09-07)

The inventory this answer rests on was reviewed by an independent agent that opened ~45 of
its citations and re-ran its off-device execution. The verdict — *lifts behind a backend
interface* — held. Four things in the supporting detail did not, and are fixed above or
recorded here:

- **Every line number in the inventory's cv-replay section was wrong** (it is a 296-line
  file, not 250). The `ev.confidence >= CONF` citation is corrected above to `:199`. The
  claim itself is true of the code; only the coordinates were written from memory.
- **The settings-read enumeration was incomplete** — five call sites, not four.
- **The dependency action is *declare*, not *install*.**
- **"Nothing consumes the backends polymorphically" was wrong.**
  `run_detection(args, context, backend, camera_service)` (`detection_loop.py:667`) takes
  the backend as a parameter and documents the contract at `:669-672`; it is written
  polymorphically and is only ever handed one implementation. The defect is confined to
  `_create_backend` (`sack_detector.py:2461-2468`) — which makes connecting
  `UltralyticsBackend` a smaller change than this ticket first implied, not a larger one.

**Two open items this answer inherits and does not close:**

1. **The flagged-item ledger.** `RegionManager`'s flagged ledger
   (`line_counter.py:748-993`) is MQTT/journal-shaped device bookkeeping — `flag_event`,
   `flagged_id`, `session_id` — and the lift plan carries `line_counter.py` verbatim without
   classifying it. A package that drags a session/MQTT ledger into the Lab has not separated
   the layers. **This is on the critical path of the lift** and must be settled before the
   package is cut.
2. **Deployed knob values were never read from a running container.** Everything in the
   inventory's knob table is this Mac's checkout. The repo's own rule
   (`verify-deployed-config-from-device`) is that the running container is the authority,
   and this project has already been burned by trusting a checkout instead. Any config the
   shared package ships as "the deployed default" is unverified until read via
   `docker inspect` / `docker exec` on a device.

**One finding that becomes an acceptance gate rather than a code fix.** The Lab venv runs
`ultralytics 8.4.56` while the contract pins `8.4.138`. `tests/test_contract.py:65-71`
deliberately downgrades that to a warning and says why, honestly — a green tick must not
imply more than it earned. The consequence stands regardless: `check_against_ultralytics()`
today proves the schema matches **8.4.56**, and the pin exists precisely because the Muon
defect lived in exactly one upstream release. v1.0.0 must require the pinned version present.

---

## Blocker 1 resolved (2026-09-07): the flagged ledger lifts

The verification pass left this open and on the critical path — `RegionManager`'s flagged
ledger (`line_counter.py:748-993`, ~245 of the file's 1,020 lines) looked like
MQTT/journal-shaped device bookkeeping because of its vocabulary: `flag_event`,
`flagged_id`, `session_id`, approve / reject / reserve / commit / rollback.

**It is not. It lifts with the rest of the core.** Verified directly:

- **The whole file imports nothing device-specific**: `logging`, `math`, `time`,
  `collections`, `dataclasses`, `datetime`, `typing`, `cv2`, `numpy`, plus
  `src.config.settings` — the injection point already identified — and
  `src.counting.roi_config` and `src.detector.detection_split`, both of which are
  already inside the lifted core.
- **Lines 748-993 touch nothing at all beyond that.** A scan for `settings.`, `os.`,
  `environ`, `getenv`, `socket`, `sqlite`, `mqtt`, `publish`, `requests` and `json.`
  across that range returns only docstrings.
- **The store is a plain in-memory dict**: `self._flagged_items: Dict[str, Dict[str, Any]]`
  (`line_counter.py:481`). There is no journal, no queue, no client.
- **`session_id` is a parameter, supplied by the caller.** The only caller is the glue
  layer, `detection_loop.py:1494`. The ledger never obtains one for itself.

So what it holds is *review state* — a crossing that a human must confirm, and where in
that state machine it currently sits. That is domain logic, and the Lab needs exactly the
same concept the moment an evaluation can produce a flagged crossing. The names sound
like transport because the transport is what consumes them; the module is transport-free.

**Consequence for the lift plan:** carry `line_counter.py` whole, as
[01](./01-lift-the-edge-counting-stack.md) proposed. The publish-before-commit protocol
(`reserve_next_approved_flagged` → `commit_finalized_flagged` →
`rollback_flagged_finalization`) travels with it and is worth having: it is the shape a
Lab needs too, where "published" becomes "written to `evaluations`".

**Blocker 2 remains open**: the deployed knob values still have not been read from a
running container, and the repo's own rule is that the container — not a checkout — is
the authority on what is deployed.

## Blocker 2 resolved (2026-09-07): the deployed knobs, read from a running container

Read from **edge003**, the fleet's DEV device, via `docker inspect` and `docker exec` on
the `sack-detector` container (up 4 days, healthy) — not from a checkout, which the
repo's own `verify-deployed-config-from-device` rule says is not evidence.

`/app/config/tuning.yaml` in the container, dated 2026-09-02:

| Knob | Deployed | Unit / semantics, per the file's own comment |
|---|---|---|
| `tracker.track_thresh` | `0.3` | confidence fraction — seeds/sustains a track |
| `tracker.track_buffer` | `30` | frames a lost track is retained |
| **`tracker.match_thresh`** | **`0.7`** | **IoU threshold for association** — stated outright |
| `counting.roi_dedup_distance_px` | `25` | pixels |
| `counting.roi_dedup_frames` | `120` | frames the spatial dedup stays active |
| `counting.count_cooldown` | `40` | frames between a count and an opposite re-count |
| `counting.conf_threshold` | `0.60` | confirmed/flagged split |
| `counting.stale_id_frames` | `300` | frames — **declared, never loaded** |
| `scorer.passthrough` | **`false`** | the scorer actively gates confirm/flag/drop |
| `predictor.mode` / `history_n` | `quadratic` / `6` | **declared, never consumed** |
| `heal.enabled` | `true` | occlusion re-link healer wired in |
| identity firewall / birth-crossing | `true` / `true` | both live |

### Four things this settles

1. **`match_thresh` is an IoU threshold on the device, in writing.** The shared config
   schema must carry that meaning, which is what this ticket already required — it is now
   evidenced rather than asserted. The Lab folding it into a pixel distance is a
   divergence from the deployed semantics, not a difference of opinion.

2. **The Lab's numbers were right; only their meanings diverged.** `LabConfig`'s
   defaults — conf_split 0.60, roi_dedup_px 25, roi_dedup_frames 120, cooldown 40,
   track_buffer 30, match_thresh 0.70 — match the deployed values **exactly**. That is
   worth knowing before the lift: the migration is of semantics, not of values.

3. **`scorer.passthrough: false` on the live device**, confirming that `cv-replay`'s
   hand-rolled passthrough is not deploy-truth. Previously inferred from the repo file;
   now read from the machine.

4. **Three dead knobs confirmed on the running system, not just in the checkout.** The
   container's environment holds `TRACKER_TYPE=botsort`, and
   `docker inspect --format '{{json .Config.Cmd}}'` returns
   `["python","-u","run.py","--stream","--weather","owa","--save","--resolution","1280x720","--classes","0,1"]`
   — **no `--tracker-mode`**, so argparse's default selects `ByteTrackWrapper` and the env
   var is inert on the deployed device. `stale_id_frames` and the `predictor` pair are
   declared in the deployed file and consumed by nothing.

**No counting knob is set in the environment at all** — every one comes from
`tuning.yaml`. The inventory claimed this and the verification pass disputed its
completeness; read from the container, the claim holds.

**Both blockers on cutting the counting package are now closed.**
