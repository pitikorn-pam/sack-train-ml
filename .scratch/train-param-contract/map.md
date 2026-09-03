# Map: Training parameter contract

Label: `wayfinder:map`

## Destination

A **decision-complete spec** for the parameter contract that runs from the web "New training run" form, through the stored run config and the Colab notebook, to `model.train()` and the Hailo compile — such that:

1. an invalid config is rejected **before** a Colab session burns GPU time (*fail fast*),
2. no value that affects the outcome is invisible to the person launching the run (*no silent default*),
3. the values a finished run actually used can be read back afterwards (*what-you-set-is-what-ran*).

The spec is the finish line. Implementing it is a separate effort.

## Notes

**Domain.** YOLO training on Colab → ONNX → Hailo-8L `.hef` for a Pi 5 edge device. Surfaces in scope: the React form (`apps/web`), the run config + `start-training` edge function, `notebooks/train_run.ipynb` + `scripts/train_for_run.py` + `src/sack_train_ml/training.py`, and the compile path (`compile_options` → `hailo_pipeline.py` → `scripts/compile_clientrunner.py`, plus the stale `notebooks/compile_run.ipynb`).

**Skills every session should consult.** `grilling` and `domain-modeling`. See also `CONTEXT.md` at the repo root for the glossary this effort is building.

**The horizon this sits inside** (settled 2026-09-03, and deliberately *not* the destination). The long-term shape is a **Lab**: a place to configure, launch and compare training and compile runs. Current focus stays on **train + compile**, so the horizon informs taste, not scope. Four framing decisions taken with it:

- *"Lab" names the platform.* The existing video-replay tab is renamed **Replay** — one instrument inside the Lab, not the Lab itself. See `CONTEXT.md`.
- *Colab stays the executor.* Not a reluctant default: it is chosen, and the design rule that keeps the option open costs nothing — **a notebook is a launcher, never a config holder**. `train_run.ipynb` already obeys this (it takes only `?run_id=` and pulls the rest from the registry); `compile_run.ipynb`'s hand-edited config cell is the violation.
- *Generalise for more model lines, not more frameworks.* Design fully for a second model line on the same YOLO→Hailo path; leave a thin seam at the compile/target layer; build nothing for other training frameworks until a second one actually exists (`README.md` North Star, and the parent `CLAUDE.md` rule against unrequested flexibility).
- *The parameter UI is the deliverable that matters most.* Complete, correct inputs on the form come before anything else the Lab might eventually do.

**Standing preferences.**
- Plan, don't do — every ticket resolves a *decision*. If a session feels the pull to start implementing, that is the signal the map has reached its edge.
- Evidence before claims. This repo's parent `CLAUDE.md` carries an Experiment Discipline section written because "claim-before-verify" recurred in 9 of 9 recorded sessions. Name the `file:line` or command output behind any assertion; mark anything unverified as unverified.
- Simplest thing that meets the actual requirement. No configurability nobody asked for.

**Why this effort exists** (two real incidents, both from 2026-09-02):
- *The Muon crash.* No `optimizer` key existed in the form, the config, or `DEFAULT_TRAIN_KWARGS`, so ultralytics' `optimizer="auto"` picked the experimental Muon optimizer, which crashed at epoch 1. A default nobody could see cost a Colab session. Patched by pinning `AdamW` (`367fe15`).
- *The INT8 collapse.* A model scoring 0.85–0.97 in FP32 produced a HEF scoring below 0.2, compiled with `optimization_level: 2` / `calib_images: 1024` against calibration images sampled from its own training split. Nothing in the pipeline measured INT8 quality before the artifact was published.

Both share one root: **the parameter surface is not a contract**. Defaults live in two unlinked copies (`NewRun.tsx:45-51` and `training.py:22-33`), the UI exposes a subset of what the pipeline reads, and no layer validates the config's contents — verified across all three: the form checks 4 fields for presence only (`NewRun.tsx:151-159`), the edge function checks only that `config` is an object (`supabase/functions/start-training/index.ts:47`), and Python splats `hyperparameters` straight into `model.train(**kwargs)`.

## Decisions so far

<!-- one line per resolved ticket: gist + link -->

- [What can ultralytics training actually tune, and can we validate it programmatically?](./issues/01-ultralytics-train-args.md) — validating custom params is cheap (`DEFAULT_CFG_DICT` + `check_dict_alignment` + `check_cfg`, all verified in the venv), and unknown keys already fail fast; the real gap is that 29 of 115 keys — `optimizer` among them — get **zero** value checking, so our own enum table is unavoidable. The Muon bug existed in exactly one upstream release: nothing pins the toolchain.
- [What can the Hailo compile tune, and why did INT8 collapse?](./issues/02-hailo-compile-params.md) — `optimization_level=2` is quantization-aware **fine-tuning** (4 epochs, 1024 images, wants a GPU), and a diverging QFT is the leading explanation, matching a same-shaped incident this team hit on 2026-07-21. Two side-findings: our generated ALLS omits the cls `sigmoid` that Hailo's own recipe carries, and the reported "below 0.2" scores cannot have come from the HEF output, whose on-chip floor is 0.2.
- [Every trainable model, and which ones can reach a Hailo-8L HEF](./issues/03-model-catalogue.md) — 46 checkpoints train, **5 compile correctly**; the hardcoded `/model.23/` head prefix (the index is 22 on YOLOv8, 42 on YOLOv9e, 21 on YOLO12) is the single cause, and the fix is small. Worse: the `yolo26*` options already in the form produce HEFs that report success and count zero on the device, and pose compiles with its keypoint branch amputated.

## Not yet specified

- **Implementation sequencing** once the spec is decision-complete — which surface changes first, and whether the form and pipeline can land independently.
- **Migrating existing runs** whose stored config predates the schema. Do old runs need to remain readable/re-runnable, and does the schema need a version field?
- **Edge-function deployment shape** — if validation lands server-side, the schema has to reach Deno too, and `supabase functions deploy` becomes part of the release step.
- **Valid-but-unwise configs** — the preview step will be able to tell the difference between "rejected" and "allowed but a bad idea" (e.g. `opt_level: 2` with a training-split calibration set). Whether that is a warning, a required acknowledgement, or nothing at all.
- **Whether the Models / Storage tabs need to surface effective config too** — likely follows whatever provenance decision lands, so it cannot be phrased sharply yet.

## Out of scope

- **The Lab tab** (`webui/lab_core.py`, `apps/api/lab_server.py`) — a separate subsystem for replaying video through the counting pipeline, not part of the train path.
- **The Overview / Models / Storage tabs** — not part of launching a run.
- **Designing the INT8-vs-FP32 quality gate** — this spec requires only that a measurement exists and travels with the HEF. How it is measured and what threshold passes is its own effort.
- **Building the YOLO26 compile pipeline.** The owner has decided YOLO26 keeps its place and gets its own path rather than being dropped ([12](./issues/12-interim-remove-undeployable-options.md)). Its 4-channel box head cannot use the on-chip `meta_arch=yolov8` NMS, so it needs raw output plus a matching host-side decoder — and that decoder lives in `sack-detector-edge`, which this repo explicitly does not own (`AGENTS.md`). It is therefore its own effort, requiring a cross-repo contract, not a ticket here. What *does* stay on this map is how the parameter contract expresses more than one compile path ([06](./issues/06-fields-vs-escape-hatch.md)).
- **Making "experiment" a first-class object.** Today there is no way to say "these three runs are one ablation differing only in `opt_level`" — the registry holds `runs` and nothing groups them (`model_lines, runs, run_metrics, versions, channels, channel_deployments, channel_history`), so the parent `CLAUDE.md` rule of one-changed-lever-per-run cannot actually be *practised* in the system; the pairing lives in someone's head. This is the widest gap between "a webapp that trains" and a Lab, and it belongs to the horizon — the current focus is train + compile.
- **Implementing the spec** — this map ends at decisions.
