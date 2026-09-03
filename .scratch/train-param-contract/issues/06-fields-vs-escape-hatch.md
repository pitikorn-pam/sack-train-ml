# 06 — Which parameters are first-class fields, and what does the escape hatch allow?

Type: grilling
Status: open
Blocked by: 01, 02, 03, 11

## Question

The chosen approach is a **curated core plus a validated escape hatch**. This ticket draws the line.

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
8. **Is the catalogue generated or hand-written?** Some documented checkpoints cannot be downloaded by the installed ultralytics at all, which argues for generating the list against the pinned version ([10](./10-toolchain-pinning.md)) rather than maintaining it by hand as today (`NewRun.tsx:18-29`).
