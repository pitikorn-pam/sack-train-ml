# 02 — What can the Hailo compile tune, and why did INT8 collapse?

Type: research
Status: resolved
Blocked by: —

## Question

Enumerate the tunable surface of the Hailo DFC compile as this repo drives it: `model_optimization_flavor` (what each `optimization_level` actually enables, and the calibration-set size each level expects), the model-script/ALLS commands worth exposing (`normalization`, per-layer precision overrides, `post_quantization_optimization`, `nms_postprocess` and every field of it), and the documented requirements on the calibration set — size *and* domain representativeness.

Underneath that sits the incident this effort must not repeat: a model at 0.85–0.97 FP32 confidence produced a HEF scoring below 0.2, compiled at `optimization_level: 2` with 1024 calibration images sampled from its own training split. Rank the likely causes from the evidence and — more valuable — establish **what diagnostic would tell us which layer destroys the accuracy**, runnable in the same Colab session before anything is published (layer noise analysis, emulator inference on the quantized HAR, FP32-vs-INT8 comparison).

The answer feeds [06](./06-fields-vs-escape-hatch.md) (which compile knobs deserve to be fields) and the scope note about attaching an INT8 measurement to every HEF.

Findings land in `../research/hailo-compile-params.md`.

## Answer

**`optimization_level=2` is not "more careful quantization" — it is training.** Hailo documents level 2 as *Equalization + Finetune (4 epochs, 1024 images)*, i.e. quantization-aware fine-tuning. Levels above 0 expect a GPU; without one, DFC logs `Reducing optimization level to 0`. So the parameter the UI presents as a quality dial actually starts a gradient-based optimisation whose divergence is silent. Ranked most likely cause of the collapse: **QFT diverging in that Colab session.** Supporting precedent from this team's own history (2026-07-21): an identical symptom shape — dead HEF despite FP32 max-conf 0.94 — resolved by recompiling, after which v5.5 deliberately used opt-0.

**A second, independent defect surfaced.** Hailo's official `yolov11s.alls` carries three `change_output_activation(<cls_conv>, sigmoid)` lines; the ALLS this repo generates (`scripts/compile_clientrunner.py:198-216`) has none. The YOLOv8 NMS op in HailoRT v4.20.0 applies **no** sigmoid of its own (verified against the MIT-licensed source), so the cls tensor must already carry probabilities. Whether DFC 3.33 auto-inserts the activation is **UNVERIFIED** — `hailo har extract --auto-model-script-path` settles it in about two minutes. → raised as [11](./11-verify-cls-sigmoid-in-alls.md), which [06](./06-fields-vs-escape-hatch.md) needs before it can decide what the generated ALLS must contain.

**Eliminated by source reading, not guessed:** a wrong `regression_length` or decoder-to-stride mapping produces *bad boxes with healthy scores*, and a wrong `classes` produces a hard buffer-size error — neither can yield a graded score collapse. `meta_arch=yolov8` is correct for YOLOv11 DFL heads (the Model Zoo uses it).

**Version pairing is off-matrix but is not the culprit.** Hailo staff pair DFC 3.30.0 with HailoRT 4.20.0; this repo uses 3.33.1. Worth fixing, but its failure mode is loud (firmware/HEF-version errors), not a graded accuracy loss. Feeds [10](./10-toolchain-pinning.md).

**Measurement provenance is itself in doubt — and was then confirmed unknown.** `nms_scores_th` is a *hard floor* applied on-chip, and this repo sets it to 0.20 — so nothing scoring below 0.2 can leave the HEF at all, and the reported "scores fell below 0.2" cannot have been read at the HEF output. Asked where the figure came from, the owner confirmed she did not author it; it arrived from another source. **It is therefore UNVERIFIED and must not be reasoned from.** What remains established is the shape of the failure (an INT8 artifact that does not detect), which matches the 2026-07-21 dead-HEF precedent; the specific numbers do not survive. Any further diagnosis starts by *making* a measurement, not by explaining that one.

**Diagnostic to reach for** (belongs to the separate collapse-debugging thread, not to this map): emulator inference on the quantized HAR, `InferenceContext.SDK_FP_OPTIMIZED` versus `SDK_QUANTIZED` on the same frames, which localises the damage to `optimize()` without touching a device.

