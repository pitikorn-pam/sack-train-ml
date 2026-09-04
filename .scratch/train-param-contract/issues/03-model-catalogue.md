# 03 — Every trainable model, and which ones can reach a Hailo-8L HEF

Type: research
Status: resolved
Blocked by: —

## Question

The "Source weights" dropdown currently hardcodes 10 options (`apps/web/src/components/NewRun.tsx:18-29`). It should offer **every model that can actually be trained** — YOLOv8, YOLO11, YOLO26 and whatever else ultralytics supports — with each option marked **compile-capable or train-only**.

Produce the decision table the form will be built from: one row per selectable checkpoint (exact filename — `yolov8s.pt` and `yolo11s.pt` differ in whether the "v" is there, and a wrong string is a broken run), with family, task, and Hailo-8L compile status.

Three different questions hide inside "can it compile", and they must be kept apart:
1. does Hailo support the architecture in principle (Model Zoo recipes, Hailo-8L capacity vs Hailo-8),
2. does **this repo's** `scripts/compile_clientrunner.py::detect_head()` handle it *today* — it hardcodes the `/model.23/` head prefix and only recognises YOLOv11 (`cv2.N`) vs YOLO26 (`one2one_cv2.N`) naming,
3. what would have to change to close the gap.

Whether the head sits at `model.23` across families (is YOLOv8's at `model.22`?) decides whether "support all models" is a small change or a large one.

Findings land in `../research/model-catalogue.md` (519 lines, incl. the full per-checkpoint table).

## Answer

**46 detect/segment checkpoints are trainable. This repo's compile script handles 5 of them correctly today** — `yolo11{n,s,m,l,x}.pt`, the only ones reaching on-chip NMS. Of the rest, 26 parse but land on a degraded path and 20 fail outright.

**The head index is the whole problem, and it is not always 23.** Established empirically, not by reading: `detect_head()` was imported and run against real ONNX exports of ten architectures. YOLOv8 and YOLOv9t–c put the head at `model.22` (verified node name `/model.22/cv2.0/cv2.0.2/Conv`), YOLOv9e at `model.42`, YOLO12 at `model.21`. The hardcoded `/model.23/` prefix in `scripts/compile_clientrunner.py` therefore makes YOLOv8, YOLOv9 and YOLO12 exit outright. **This is a small fix** — deriving the index by regex plus `max()` was prototyped and resolves all six end-nodes across all ten architectures, exotic indices included.

**Three findings beyond the ticket, each of which changes a decision:**

1. **The YOLO26 options already in the dropdown produce undeployable HEFs.** YOLO26's box conv emits 4 channels (measured; Hailo's own config agrees), and no edge decoder can read that — the runtime requires a 64-channel DFL box (`sack-detector-edge` `v6_instance_backend.py:100`). Training, export and compile all report success; the device then counts zero. This is a live trap in the current form, and the exact silent-failure class this effort exists to remove → [12](./12-interim-remove-undeployable-options.md).
2. **Pose and OBB compile "successfully" with the keypoint branch silently amputated.** `task` is decided by `has_proto and has_cv4`, so pose is classified as detection and handed on-chip NMS. Verified for `yolo11n-pose`.
3. **YOLOv10 is misidentified as YOLO26** — both name their branch `one2one_cv2` — and is denied on-chip NMS it should have: its box is a 64-channel DFL head, and Hailo's own `yolov10n.alls` uses `meta_arch=yolov8` on byte-identical end-nodes.

**Hailo's own support is wider than ours.** Read from a local `hailo_model_zoo-2.18.0` wheel and cross-checked against the docs: for detection, HAILO8 and HAILO8L publish **identical 63-model sets** — no capacity exclusion, only an FPS difference — and `meta_arch=yolov8` officially covers v8, v9c, v10 and v11. Our gate is narrower than the hardware's. RT-DETR and YOLOE are absent from the zoo; YOLO-World is hailo15h-only.

**The dropdown must be generated against the installed ultralytics, not the docs.** `yolov9c-seg.pt`, `yolov8x-pose-p6.pt` and `yolo26*-depth.pt` appear in documentation but are missing from 8.4.56's `GITHUB_ASSETS_NAMES` — they cannot be downloaded at all. This ties the catalogue to [10](./10-toolchain-pinning.md).

### Catalogue verified against the official pages (2026-09-04)

Checked directly against [docs.ultralytics.com/models/yolo11](https://docs.ultralytics.com/models/yolo11) and [/yolo26](https://docs.ultralytics.com/models/yolo26), and folded into the prototype:

- **Task lists differ between the families, and the earlier numbers were right.** YOLO11 publishes **five** tasks (detect, instance seg, classify, pose, OBB). YOLO26 publishes **seven**, adding **semantic segmentation** and **depth estimation**. Checkpoint suffixes: `-seg`, `-sem`, `-depth`, `-cls`, `-pose`, `-obb`.
- **Only detection has a published performance table** on either page; every other task shows no numbers, so the catalogue says "no published table" rather than inventing one.
- Detection figures now carried in full, verbatim, including **FLOPs** — previously missing — and YOLO26's second accuracy column: its **end-to-end (NMS-free) mAP**, which is the number that applies to its default head. YOLO11: 39.5 / 47.0 / 51.5 / 53.4 / 54.7 at 6.5–195.3 GFLOPs. YOLO26: 40.9 / 48.6 / 53.1 / 55.0 / 57.5 with e2e 40.1 / 47.8 / 52.5 / 54.4 / 56.9, at 5.5–194.4 GFLOPs.
- P2/P6 exist only as YAML configs — **no `yolo26*-p2.pt` or `-p6.pt` weights are released** — so they must never appear as selectable checkpoints.

**The YOLO26 blocking reason is now documented fact rather than inference.** The page states plainly that YOLO26 *"removes Distribution Focal Loss"* and that its default one-to-one head *"produces predictions without non-maximum suppression"*. That is exactly why the on-chip `meta_arch=yolov8` decoder — which expects a 64-channel DFL box — cannot read it.

**And a lead that changes the size of the YOLO26 effort:** the same page states the models *"support both a one-to-one head (NMS-free, default) and a one-to-many head (traditional YOLO with NMS)"*. If the one-to-many head carries the classical DFL box, a YOLO26 → Hailo path may be reachable through it rather than requiring a new host-side decoder. Unverified against a real exported graph — worth checking before that effort is scoped.

**Researcher's recommendation, which conflicts with the stated preference and must be settled in [06](./06-fields-vs-escape-hatch.md):** ship 5 selectable rows (`yolo11*`), 10 disabled-with-reason (`yolov8*`, enabling the day the index fix lands), plus `yolo11s-seg`, and offer nothing else. The owner's stated preference is to list *every* trainable model with compile-capability marked. Both are defensible; the tension is exactly what "compile-capable versus train-only" has to resolve.

