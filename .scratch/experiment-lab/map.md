# Map: The Experiment Lab

Label: `wayfinder:map`

## Destination

A **decision-complete spec** for the Experiment Lab: the place where a trained model is
measured against a library of ground-truthed scenario clips, using **the same counting
engine that runs on the device**, with every verdict recorded where the registry can
compare it — plus a `DESIGN.md` design system the whole web app follows.

The spec is the finish line. Implementing it is a separate effort.

## Notes

**Why this effort exists — a finding, not a feeling.** The Lab that exists today cannot
answer the only question it is asked. Verified 2026-09-07:

- `webui/lab_core.py:61` — `tracker_type: str = "centroid"  # deterministic local tracker; not ByteTrack`
- `webui/lab_core.py:518` — `match_distance = max(float(cfg.roi_dedup_px), 50.0 * max(0.0, 1.0 - float(cfg.match_thresh)))`

The form's **"Match threshold"** control carries ByteTrack's name and ByteTrack's numbers
(0.70, 0.80) but is converted by an ad-hoc formula into a **pixel radius** (0.70 → 15px)
and fed to a greedy nearest-centroid tracker. The device runs `HailoBackend` + real
ByteTrack, where the same knob is an IoU threshold — and where turning it 0.7 → 0.8 was
measured at −18% id churn. Same name, different algorithm, different units.

So the Lab returns numbers that look authoritative and describe a counting stack nobody
ships. That is worse than having no tool, because a wrong yardstick is trusted. The
`380/380` result was produced by `cv-replay` on the device, **not** by this engine — an
earlier claim in this session that said otherwise was wrong, and the owner caught it.

**Domain.** A trained YOLO checkpoint (`.pt`) or its compiled Hailo artifact (`.hef`) is
run over video; sacks crossing a line are counted; the count is compared against a
ground-truth number for that clip. Surfaces in scope: `apps/web/src/sections/Lab.tsx` (596
lines), `apps/api/lab_server.py` (752), `webui/lab_core.py` (619) + `webui/lab_path.py`,
`apps/web/src/lib/labApi.ts`, the registry schema in `supabase/migrations/`, R2 via
`supabase/functions/_shared/r2.ts`, and the counting stack inside `sack-detector-edge`.

**Skills every session should consult.** `grilling` and `domain-modeling`. `prototype` for
the two prototype tickets.

### Framing settled while charting (2026-09-07, with the owner)

Not tickets — the decisions that fixed this map's scope before it had one.

- **This map ends at a spec.** The last ticket produces a build order so implementation can
  start without re-deciding anything.
- **The Lab's job**: a measuring instrument for a finished model — a library of clips
  covering different situations, run to see how detection behaves, with config editable as
  **pipeline automation** rather than one hand-driven run at a time.
- **Redesign, not patch.** The owner is not confident in the current stack or its internal
  compatibility, and that lack of confidence turned out to be well-founded (see the finding
  above). The Lab becomes the umbrella the other surfaces sit inside.
- **No language rewrite.** `ultralytics`, `hailo_sdk_client` and `opencv` are Python-only
  and the UI must be TypeScript; two languages is a fact of the domain, not debt. What gets
  refactored is the **seam** — extending the pattern that already works
  (`contracts/param-schema.json`: one schema, three readers) to cover Lab config too.
- **One counting engine.** The device's counting stack (ByteTrack + the real `LineRegion`)
  becomes a shared package that both the Mac (`.pt`) and the Pi (`.hef`) call, differing
  only in detection backend. The Lab's centroid tracker is retired, not kept as a mode —
  keeping it means maintaining two algorithms forever and guarantees somebody reads a
  number from the wrong one.
- **`.pt` first, `.hef` labelled and reachable.** `.pt` + ByteTrack on the Mac is
  "close to deploy", enough to compare model A against model B. `.hef` + ByteTrack on a Pi
  is deploy-truth, used when promoting. Both are valid; **every recorded number names the
  artifact it came from**, and the two are never compared without that label.
- **The `.hef` runner is device-agnostic.** Written to run on any RPi + Hailo-8L and cloned
  onto whichever box is free — not wired to `edge003`. (`edge003` is the fleet's DEV test
  device: Tailscale `100.122.220.50`, bootstrapped, 6 containers healthy, `/dev/hailo0`
  present. `edge004` has no `/dev/hailo*` and no docker; `edge001`/`edge002` are
  production.)
- **Clip storage is R2**, which is already in the stack (`_shared/r2.ts::presignGet`, used
  by `download-tool` to move a 489MB wheel to Colab in 13 seconds). Egress is free, which
  matters because an eval runner re-downloads clips every run. Long source videos stay off
  the cloud; only trimmed scenario clips go up.
- **Automation level A first**, designed so B and C fit later: A = one model across the
  whole clip library on one click (a regression suite). B = a config matrix. C = firing
  automatically when a training run finishes.
- **`DESIGN.md` is a design system**, not an architecture document: theme, fonts, colour,
  sizing, radii, animation, and the patterns for error / modal / popup / alert, plus how
  components and modules are built and integrated.

### Execution override (2026-09-07, owner directive)

This map **carries execution**, overriding wayfinder's plan-don't-do default. The owner's
words: *"ไล่ทำตามแผนและ spec / ticket ของเราให้หมด พร้อม unittest ต่างๆ, recheck uxui"* and the goal
*"Finish Enhancement sack-train-ml and finish all testcase, and Done goal when v1.0.0 done
(all function can working fine)"*, with subagents dispatched to do the work and a long
autonomous run authorised.

What that changes:

- **Decision tickets still resolve as decisions**, and they are taken on the recommendations
  under a directive to keep moving — the same footing as issue 05 of the parameter-contract
  map. Every one is **reversible**: the answer records what was chosen and what the
  alternative was, so the owner can overturn it without re-deriving it.
- **A subagent never answers a HITL question on the owner's behalf.** Subagents do research,
  implementation, and testing. The decisions are taken by the session the owner delegated
  to, and written into the ticket as such.
- **Work lands on `feat/experiment-lab`** in a worktree at
  `.claude/worktrees/experiment-lab`, never on the owner's `main` checkout.
- **The green baseline is the floor.** At the start of the run: `pytest tests/` 49 passed,
  `node contracts/verify-contract.mjs` all passing, `apps/web` build clean. Nothing lands
  that breaks any of the three, and every new behaviour arrives with a test.

**Standing preferences.**
- Plan, don't do — every ticket resolves a *decision*.
- Evidence before claims. Name the `file:line` or command output behind any assertion; mark
  anything unverified as unverified. This map opened with a claim that had to be retracted;
  the parent `CLAUDE.md` Experiment Discipline section exists for the same reason.
- Simplest thing that meets the actual requirement.

## Decisions so far

<!-- one line per resolved ticket: gist + link -->

_(none yet — this map was charted 2026-09-07 and hand-resolves nothing.)_

## Not yet specified

- **Existing lab history.** `lab_runs` / RunManifest rows already exist on the Mac. Do they
  migrate into `evaluations`, get discarded, or stay readable in a frozen view?
- **Does a verdict gate promotion?** Whether an evaluation is required before a version can
  reach `channel_deployments`, or stays advisory.
- **Closing the harvest loop.** `cv-missfind` → `cv-harvest` → `cv-upload` producing
  `data_assets` rows that name the evaluation they came from. Deliberately deferred until
  the evaluation record exists.
- **Automation B and C** — the shape of a config matrix, and what "fires when training
  finishes" means for cost and for trust in the resulting numbers.
- **Auth and multi-user** once the Lab stops being one person's laptop.
- **INT8-vs-FP32 as an evaluation kind** — the parameter contract needs this measurement
  recorded somewhere and it plausibly is just an evaluation with two artifact kinds, but
  that cannot be phrased sharply until the record's shape is settled.

## Out of scope

- **Phase 2 platform work** — multi-tenant schema, a generic `train-ml-core`, per-project
  notebook templates. The README's rule is to extract a framework when a second project
  arrives; it has not.
- **Automating annotation.** Roboflow is fine; finding *which* frames deserve annotating is
  the bottleneck, and `cv-missfind` already does that.
- **Other training frameworks.** Nothing until a second one actually exists.
- **The YOLO26 compile pipeline** — carried over from the parameter-contract map; still its
  own effort.
