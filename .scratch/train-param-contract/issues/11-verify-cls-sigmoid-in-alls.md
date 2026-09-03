# 11 — Does DFC auto-insert the cls sigmoid, or must our ALLS emit it?

Type: task
Status: open
Blocked by: —

## Question

Raised by [02](./02-hailo-compile-params.md). Hailo's official `yolov11s.alls` carries three `change_output_activation(<cls_conv>, sigmoid)` lines. The ALLS this repo generates (`scripts/compile_clientrunner.py:198-216`) carries none. The YOLOv8 NMS op in HailoRT 4.20.0 applies no sigmoid itself, so the classification tensor reaching it must already hold probabilities — if DFC does not insert the activation for us, every HEF this repo has produced feeds raw logits into a threshold expecting probabilities.

This is a **fact to establish, not a decision to make**, and it needs a DFC environment (Colab), so it is a task rather than a research ticket.

**Checklist:**

1. In a Colab session with the DFC venv from `hailo_pipeline.ensure_dfc_venv`, take any `*_parsed.har` this repo produced.
2. Run `hailo har extract --auto-model-script-path <parsed.har>` and read the model script DFC generates for itself.
3. Record whether `change_output_activation(..., sigmoid)` appears for the three cls convs, verbatim.

**What the answer changes:** if DFC does *not* auto-insert it, the ALLS generator must emit those lines and [06](./06-fields-vs-escape-hatch.md) must treat output activation as part of the generated-parameter surface rather than something the compiler handles. If it does auto-insert, the hypothesis is closed and the collapse investigation keeps pointing at `optimization_level`.

Record the verbatim command output in the answer — this is exactly the kind of claim that must not be paraphrased.
