# 06 — Which parameters are first-class fields, and what does the escape hatch allow?

Type: grilling
Status: resolved
Blocked by: 01, 02, 03

<!-- 11 was listed here and has been removed: the sigmoid answer decides one row of the
     parameter table, not the shape of the decision. That row stays conditional on 11. -->


## Question

The chosen approach is a **curated core plus a validated escape hatch**. This ticket draws the line.

*Simplified by [08](./08-compile-notebook-and-recompile-flow.md):* a compile is now its own run kind, so train hyperparameters and `compile_options` belong to **two different forms**. This ticket no longer has to fit both onto one page — it decides each form's contents separately, and the cross-field rules that span them (a train-only checkpoint, a calibration set that suits `opt_level`) become rules *between* the two runs rather than inside one config.

Today the form exposes `epochs, imgsz, batch, patience, lr0` (`NewRun.tsx:45-51`) plus `compile_hef, opt_level, calib_n, wheel_key`, while the pipeline reads more than that — `compile_options` alone also honours `scores_th, iou_th, max_per_class, reg_len, net_name, venv_dir` and the newly added `calib_dir` (`scripts/train_for_run.py:271-311`), none of which the UI can set.

Decide:

1. **Which parameters earn a labelled field**, given the answers from [01](./01-ultralytics-train-args.md) and [02](./02-hailo-compile-params.md). The bar should be "changing this is a normal part of an experiment here", not "ultralytics supports it".
2. **What the escape hatch accepts and how it is checked** — free-form JSON validated against the real argument list, or a narrower allow-list.
3. **How the form expresses compile-capable versus train-only models** ([03](./03-model-catalogue.md)) — and what happens to the compile fields when a train-only checkpoint is selected. Silently producing a broken HEF is the failure mode to design out.
4. **Cross-field rules**, which are where the real damage lives: `opt_level: 2` expects a calibration set of a certain size and character; `calib_n` interacts with `calib_dir`; `reg_len` and the on-chip NMS decoder only make sense for DFL heads. Which of these are hard rejections and which are warnings?

The `optimizer` parameter is the canary: whatever this ticket decides must make it impossible for a value like that to affect a run while being invisible to the person launching it.

Sharpened by [03](./03-model-catalogue.md):

5. **How wide does the catalogue go?** The stated preference is to list *every* trainable checkpoint with compile-capability marked; the researcher recommends showing only what works (5 rows) plus `yolov8*` disabled-with-reason. 46 checkpoints are trainable and 5 compile correctly today, so the gap between "trainable" and "deployable" is the thing the UI has to make legible.
6. **Which architectures do we commit to supporting?** Hailo's `meta_arch=yolov8` officially covers v8, v9c, v10 and v11, and the head-index fix that would unlock v8/v9/v12 was prototyped and is small. So the current 5-model limit is our own, not the hardware's — deciding where to stop is a real choice, not a constraint.
7. **Compile-capability is per *path*, not a yes/no.** The owner has decided YOLO26 gets its own compile pipeline ([12](./12-interim-remove-undeployable-options.md)) rather than being dropped, so a checkpoint can be capable via on-chip NMS, via raw host decode, via a YOLO26-specific path, or not at all — and each path implies a different `compile_options` shape and a different edge-side decoder. The contract has to carry that, and the form has to show it.
8. **When is each parameter fixed, and what does changing it cost?** The owner's framing — these numbers are tuning knobs, not constants — exposes a dimension the current design has no word for. `nms_scores_th` is *baked into the HEF at compile time*, so changing it means a recompile; the edge's own confidence thresholds are runtime settings changeable with a restart. Three layers currently hold a "how confident before I believe it" value at three different change-costs, and nothing tells the person turning one which layer they are touching.
9. **Three tiers of un-tunability exist, and they need different fixes.** (a) Present and reachable — `calib_n`, `opt_level`, exposed in the form. (b) Present in code but not in the UI — `scores_th`, `iou_th`, `max_per_class`, `reg_len`, reachable only by hand-editing JSON. (c) **Absent from the generated ALLS entirely** — `change_output_activation` sigmoid, output precision (`a16_w16` on cls layers), `input_conversion` (the edge's real pixel format), `set_seed`, and the level-2 sub-knobs `finetune.{epochs,dataset_size,learning_rate}` that `optimization_level=2` hides. Tier (c) is the worst case: a value that cannot be tuned because the compile never emits it, and whose default is therefore invisible *and* unrecorded.
10. **Is the catalogue generated or hand-written?** Some documented checkpoints cannot be downloaded by the installed ultralytics at all, which argues for generating the list against the pinned version ([10](./10-toolchain-pinning.md)) rather than maintaining it by hand as today (`NewRun.tsx:18-29`).

## Answer

### Every parameter lands in one of four categories

"Complete" does not mean "everything editable" — opening some values *is* the failure mode.

| Category | Meaning | Examples |
|---|---|---|
| **Field** | Editable, validated, with a default and help text. | `epochs`, `optimizer`, `calib_n` |
| **Advanced** | Editable through a JSON escape hatch, checked against the real argument list before submit. | `weight_decay`, `hsv_*`, `cos_lr` |
| **Derived — shown, not editable** | A *fact* about the model or the run it descends from, not a choice. Making it editable is exactly how the two sides drift apart. | `classes` (from the dataset), `regression_length` (from the head), `image_dims`, `bbox_decoders`, and a compile run's input size (from its source run) |
| **Refused** | Rejected at submit. | `single_cls` (collapses person+sack into one class — trains, exports, compiles, deploys, and is wrong) |

The derived category is new to this system. It is what lets the contract satisfy *no silent default* without pretending every value is a preference: these values stay **visible and recorded**, they simply cannot be typed over. Today they are invisible, which is strictly worse.

### `imgsz` is editable, and the compile follows it

Not locked to 640. Training at 512 or 720 is a legitimate experiment, so `imgsz` is a normal field — and the coupling is expressed as a **rule between runs** rather than a restriction on one: a compile run's input size is *derived* from its source run and cannot be set independently. A mismatch is refused rather than silently producing a HEF whose input shape disagrees with the model it contains (`compile_clientrunner.py:5`, `hailo_pipeline.py:276` hardcode it today).

Note `imgsz` is one of the 29 keys ultralytics type-checks not at all, so `"640"` as a JSON string passes `get_cfg` unexamined — the field must enforce integer and multiple-of-32 itself.

### Train form — fields

Every row carries a default and help text explaining what it does *and what it affects*; that requirement is part of the schema, not the markup ([05](./05-schema-source-of-truth.md)).

| Field | Default | Note |
|---|---|---|
| `epochs` | 100 | primary cost/fit lever |
| `batch` | `auto` | Colab VRAM-bound; `auto` → `-1` already handled in `training.py::_coerce_batch` |
| `imgsz` | 640 | int, multiple of 32; the compile inherits it |
| `optimizer` | `AdamW` | **enum only, never free text**; `auto` and `MuSGD` offered but marked not recommended |
| `lr0` | 0.001 | meaningful only once `optimizer != auto` |
| `patience` | 20 | on a small dataset this is what actually ends the run |
| `close_mosaic` | 10 | last-N epochs with mosaic off, so val metrics resemble deployment |
| `mosaic` | 1.0 | the one augmentation worth a field |
| `fraction` | 1.0 | shown prominently when ≠ 1.0 — a leftover value silently under-trains |
| `seed` | 0 | required by the repo's own experiment discipline |
| `deterministic` | `true` | **added:** a seed alone does not buy reproducibility; this is what makes "same config → same result" true |
| `save_period` | 25 | **added:** Colab sessions die mid-run — this repo has lost them at epoch 196 — and a periodic checkpoint turns a lost session into a resumable one, pairing with the existing `--resume-from` |
| `freeze` | none | the natural small-dataset lever, currently unreachable |

### Compile form — fields

| Field | Default | Note |
|---|---|---|
| source run | from context | prefilled; the compile form is reached from a run or version |
| calibration set | — | chosen by key, never a path ([08](./08-compile-notebook-and-recompile-flow.md)) |
| `calib_n` | 512 | `optimization_level=2` expects ≥ 1024 — a cross-field rule, not a free number |
| `optimization_level` | 0 | 0/1/2, **with level-2's sub-knobs surfaced** rather than hidden: `finetune.epochs`, `finetune.dataset_size`, `finetune.learning_rate` |
| `scores_th` | 0.20 | hard floor — nothing below it can ever leave the HEF (DFC's own default is 0.3) |
| `iou_th` | 0.70 | deliberately high so two adjacent sacks are not merged (DFC default 0.6) |
| `max_proposals_per_class` | 50 | a truncation cap, not a hint: a busy frame silently loses its tail. Model Zoo uses 100 |
| `input_conversion` | none | makes the edge's real pixel format part of the compile contract |
| `seed` | 0 | so "recompiling fixed it" becomes reproducible evidence rather than folklore |
| diagnostics | **on** | run the FP32-vs-INT8 emulator comparison in-session. It costs compile time and is the only thing that would have caught the last broken HEF before it shipped |

Pending [11](./11-verify-cls-sigmoid-in-alls.md): whether cls-head `sigmoid` becomes a field defaulting to on, or is confirmed to be inserted by DFC and needs no knob at all.

### Derived, shown read-only

`classes` (from the dataset YAML) · `regression_length` (from the head's channel count) · `image_dims` (from the source run's `imgsz`) · `bbox_decoders` (from the parsed HN) · the compile's input shape · `compression_level` (pinned to 0).

### Refused at submit

`single_cls` · a compile whose input size disagrees with its source run · `resume` against a mismatched checkpoint, which re-loads `self.args` from the checkpoint and silently discards the config the form submitted · task-mismatched arguments for the chosen weights.

### Catalogue

Every trainable checkpoint is listed with its capability marked, as the owner asked — **and the head-index fix is in scope**. Without it the list would be red almost everywhere and the "cannot compile" labels would be half a lie: the limit is ours, not the hardware's (Hailo's `meta_arch=yolov8` covers v8, v9c, v10 and v11, and the fix — deriving the index by regex and `max()` instead of hardcoding `/model.23/` — was prototyped against ten architectures). Fixing it makes the labels true.
