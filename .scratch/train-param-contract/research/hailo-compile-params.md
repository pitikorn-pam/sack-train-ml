# Hailo DFC compile parameters — research findings

Research target: DFC **3.33.1** (Colab) → Hailo-8L `.hef` → Raspberry Pi 5 running **HailoRT 4.20.0**, custom YOLOv11s, 2 classes (person, sack), on-chip NMS.
Written for the `train-param-contract` spec: which compile knobs exist, what each does, and how to diagnose a post-quantization accuracy collapse before deploying.

## Method, and what could not be verified

The Hailo Developer Zone documentation (the DFC User Guide proper) is **login-gated**; direct fetches of `hailo.ai/developer-zone/documentation/dataflow-compiler-v3-33-0/` return only "please log in or sign up" ([verified](https://hailo.ai/developer-zone/documentation/dataflow-compiler-v3-33-0/)).
So the primary-source claims below come from three places that are public and authoritative:

1. **HailoRT source code**, MIT-licensed, tag `v4.20.0` — the exact runtime this project deploys on. This is the strongest evidence in this document for anything about `nms_postprocess` behaviour, because it is the code that actually computes the scores.
2. **Hailo Model Zoo** (`hailo-ai/hailo_model_zoo`, master) — Hailo's own reference `.alls` model scripts and NMS configs, including `yolov11n.alls` / `yolov11s.alls`.
3. **RidgeRun's Hailo wiki** and the **Hailo community forum** — secondary but detailed mirrors/quotes of the gated DFC User Guide, plus Hailo staff answers.

Where a claim rests only on a secondary mirror, it is labelled. Where I could not find a source at all, it is labelled **UNVERIFIED** and separated from fact.

---

## Most likely causes of the observed collapse, ranked

Evidence in hand, stated plainly before any inference:

- **Documented fact (this repo).** `scripts/compile_clientrunner.py` defaults to `--opt-level 0` and its own header comment says level 0 exists to "skip Bias Correction + Layer Noise Analysis"; production is described as "calib >= 1024 + opt_level 2".
- **Documented fact (this repo's own history).** Loom's memory record `v5-deployed-onsite-380` states that the **first v5 compile (`8b79d48c`, opt-2) came out DEAD — 0 detections on Hailo despite a good `.onnx` FP32 (max_conf 0.94)**; a plain recompile produced the working `dc51fa6d`; and v5.5 was deliberately compiled at **opt-level 0** as "the safer compile". The recorded root cause was "QAFT ran on CPU with calib 645<1024 → diverged → dead INT8".
- **Documented fact (Hailo).** `optimization_level=2` is not just "more quantization care" — it is *gradient-based training*: "Equalization + Finetune (4 epochs, 1024 images)" ([RidgeRun mirror of the DFC model-script docs](https://developer.ridgerun.com/wiki/index.php/Hailo/Hailo-8/AI_Software_and_Tools/Hailo_Model_Scripts)).
- **Documented fact (Hailo).** Optimization above level 0 wants a GPU; without one the DFC emits `[warning] Reducing optimization level to 0 (the accuracy won't be optimized and compression won't be used) because there's no available GPU` ([community](https://community.hailo.ai/t/problem-wigh-gpu-on-hailo-warning-reducing-optimization-level-to-0-the-accuracy-won-t-be-optimized-and-compression-won-t-be-used-because-there-s-no-available-gpu/18264), [community](https://community.hailo.ai/t/optimiziation-warnings-meaning/9429)).
- **Documented fact (Hailo).** The official `yolov11s.alls` in the Model Zoo contains **three `change_output_activation(<cls_conv>, sigmoid)` lines**; this repo's generated ALLS contains none ([yolov11s.alls](https://github.com/hailo-ai/hailo_model_zoo/blob/master/hailo_model_zoo/cfg/alls/generic/yolov11s.alls)).
- **Documented fact (HailoRT v4.20.0 source).** The on-chip/CPU YOLOv8 NMS op takes the class score as `Quantization::dequantize_output(cls_data[...], cls_quant_info)` and compares it directly to `nms_score_th` — **no sigmoid, no softmax is applied to the class tensor** ([yolov8_post_process.hpp](https://github.com/hailo-ai/hailort/blob/v4.20.0/hailort/libhailort/src/net_flow/ops/yolov8_post_process.hpp)).

### Rank 1 — `optimization_level=2`'s gradient-based finetune (QFT) diverging in this Colab environment

*Inference, built on the facts above.*
Level 2 replaces "collect ranges and quantize" with "train the quantized weights for 4 epochs against the FP32 teacher on the calibration set".
A training loop is the only stage in this pipeline that can move weights far enough to turn 0.85–0.97 confidences into near-threshold noise while leaving the graph structurally valid, and it is the one lever that differs from the known-good opt-0 recipe.
This project has already hit the *identical symptom shape once* at opt-2 (good FP32 → dead INT8, fixed by recompiling), which is the strongest single piece of evidence available.

Why it is not yet a fact: I found no Hailo document that says "level-2 finetune can diverge and destroy scores", and the documented no-GPU behaviour is to *reduce the level to 0* rather than to run a bad finetune. So either (a) the Colab DFC venv did have a usable GPU and the finetune ran and diverged, or (b) it silently ran finetune on CPU, or (c) something else entirely is going on. The compile log settles which.

**Cheapest confirming/refuting diagnostic (do this one first):** in the same Colab session, before compiling, run the *same* frames through the emulator in both contexts and compare max class scores —

```python
from hailo_sdk_client import ClientRunner, InferenceContext
runner = ClientRunner(har="yolov11s_sack_quantized.har")
with runner.infer_context(InferenceContext.SDK_FP_OPTIMIZED) as ctx:
    fp = runner.infer(ctx, frames)      # expect 0.85–0.97
with runner.infer_context(InferenceContext.SDK_QUANTIZED) as ctx:
    q8 = runner.infer(ctx, frames)      # if this is already < 0.2 → damage is in optimize()
```

If `SDK_QUANTIZED` is already collapsed while `SDK_FP_OPTIMIZED` is fine, the damage happened inside `runner.optimize(calib)` and nothing downstream (HEF, HailoRT version, edge preprocessing, NMS config) is implicated.
Then re-run `optimize()` with `model_optimization_flavor(optimization_level=0, compression_level=0)` on the identical calibration array; if the collapse disappears, the finetune is the cause.
Also grep the optimize log for `Reducing optimization level`, `Assigning 4bit weights`, and the finetune per-epoch loss lines — those three strings distinguish (a)/(b)/(c) above in one pass.

### Rank 2 — missing `change_output_activation(<cls_conv>, sigmoid)`

*Mixed: the divergence from Hailo's reference recipe is a fact; the resulting symptom is an inference and the direction does not fit perfectly.*

Hailo's own `yolov11s.alls` adds sigmoid to the three classification convs, and the HailoRT v4.20.0 YOLOv8 op applies no activation of its own — so the classification tensor reaching NMS **must already be probabilities**.
This repo's ALLS never adds it.

Direction caveat, stated honestly: if raw logits were passed through unchanged, a confident detection (logit ≈ +2.2 for p=0.9) would be *reported as score 2.2*, i.e. scores **above** 1, and everything with logit ≥ 0.2 (p ≥ 0.55) would pass — over-detection, not collapse below 0.2.
So a pure "logits instead of probabilities" bug predicts the *opposite* sign of the observed symptom.
It stays at rank 2 because (i) it is a hard, verifiable divergence from the vendor recipe, (ii) with a linear cls head the output layer's quantization range is fitted to the logit range instead of `[0,1]`, which is a genuinely worse INT8 encoding of the decision boundary and is exactly the kind of thing a level-2 finetune would then chase, and (iii) I could not verify whether DFC 3.33's `nms_postprocess(meta_arch=yolov8)` auto-inserts the sigmoid — **UNVERIFIED**. One Hailo staff reply does mention seeing "unexpected Sigmoid replacements on output heads" on a user's model, which hints that DFC sometimes inserts it ([community 18411](https://community.hailo.ai/t/custom-yolo-model-missed-detections-on-hailo8/18411)) — but a hint is not a contract.

**Cheap decisive check:** after `optimize()`, dump the effective model script and the HN and look at the activation on the three cls output layers —

```bash
hailo har extract yolov11s_sack_quantized.har --auto-model-script-path effective.alls
```

or in Python, `json.loads(runner.get_hn())["layers"][<cls_conv>]["activation"]`.
If it is `linear`, the sigmoid is genuinely absent and the ALLS must add it. If it is `sigmoid`, DFC inserted it and this hypothesis is dead.

### Rank 3 — runtime input mismatch on the edge (BGR vs RGB, or normalization applied twice)

*Documented fact that this cause exists and is common; whether it applies here is unverified.*
This is the single most frequently confirmed root cause of "great in PyTorch, collapsed on Hailo" in the Hailo forum.
Two separate threads resolved exactly this symptom by fixing channel order:
a single-class YOLO went from 0.75 recall back to 0.89 purely by feeding RGB instead of BGR ([community 15321](https://community.hailo.ai/t/yolo-recall-degradation-after-compiling-to-hef/15321)), and a fire detector with "little to no detection outputs" was fixed by a larger calib set **plus** `cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)` ([community 18411](https://community.hailo.ai/t/custom-yolo-model-missed-detections-on-hailo8/18411)).
Hailo staff in that thread: *"was the model trained in RGB or BGR? Make sure the preprocessing is correct."*

Relevant to this repo specifically: `load_calib()` builds the calibration array as **RGB** (`Image.open(f).convert("RGB")`) in the **0–255 float** range, and the ALLS puts `normalization([0,0,0],[255,255,255])` on-chip.
That means the deployed contract is *raw uint8 RGB in, no host-side scaling* — and any edge-side change that feeds BGR (the OpenCV/picamera2 default byte order) or pre-divides by 255 breaks it silently.
It is ranked below the compile-side hypotheses only because the compile config, not the edge code, is what changed in this incident.

**Cheap check:** feed one identical frame buffer through the Colab emulator and through the device, and diff the input arrays before diffing the outputs.

### Rank 4 — calibration set sampled from the model's own train/val split

*Documented guidance exists; "collapse" attribution is inference, and weak.*
Hailo's own tutorials say calibration normally comes from the training data — *"Typically, you will use images from the dataset used for training"* ([Macnica DFC walkthrough](https://www.macnica.co.jp/en/business/semiconductor/articles/hailo/145097/)) — so train-split calibration is not per se a bug.
What is documented is a **size** floor (≥1024, see §3) and a **domain-representativeness** requirement (Ultralytics: *"Calibration images should represent the lighting, viewpoints, objects, and backgrounds expected in production"*, and *"A small in-domain set beats a large out-of-domain one"* — [Ultralytics Hailo export](https://docs.ultralytics.com/integrations/hailo)).
This compile used 1024, which clears the floor.

The real risk here is second-order and *specific to level 2*: the finetune **trains on the calibration set**, so any systematic difference between calibration frames and deployment frames stops being a range-estimation nuance and becomes a training signal.
Two concrete things to check in `build_calib_dir` / `load_calib`: whether the sampled split contains augmented/mosaic frames rather than plain camera frames, and whether the letterbox padding colour used for calibration (`(114,114,114)`) matches what the edge actually pads with.
Note also that `build_calib_dir` takes the **first** `n` images of a sorted glob (`imgs[:n]`) — not a random sample — so a directory whose filenames sort by session/date yields a calibration set drawn from a narrow slice of conditions. That is a genuine representativeness defect independent of the collapse.

### Rank 5 — DFC 3.33.1 paired with HailoRT 4.20.0 (version mismatch)

*Documented fact that the pairing is off-matrix; documented fact that its failure mode is different from this symptom.*
Hailo's aligned releases put **DFC 3.30.0 with HailoRT 4.20.0** (Model Zoo v2.14), 3.31.0 with 4.21.0, 3.32.0 with 4.22.0, and 3.33.1 with the 2.18-era runtime ([Model Zoo releases](https://github.com/hailo-ai/hailo_model_zoo/releases)).
Hailo staff, verbatim: *"if you're using HailoRT 4.20, make sure you're compiling with DFC 3.30 for full compatibility"* ([community 13704](https://community.hailo.ai/t/hef-version-does-not-match/13704)).
A user hitting a firmware error with exactly **DFC 3.33.1 → HailoRT 4.20.0** was pointed at the compatibility matrix and told the right DFC for 4.20.0 is 3.30.0 ([community 19032](https://community.hailo.ai/t/yolov8-custom-model-hef-compilation-error-on-hailo-8-with-hailort-4-20-0/19032)).
Ranked low for *this* symptom because the documented failure mode is a load/parse/firmware error or a `HEF version does not match` refusal — not a graded score collapse on a HEF that loads and runs.
It is still a standing defect in the stack and should be fixed or explicitly accepted.

### Rank 6 — DFC 3.33 silent 16-bit output demotion

*Documented bug, almost certainly not applicable here.*
In DFC 3.33.0 a user reported the compiler silently demoting requested 16-bit outputs to 8-bit while leaving 16-bit dequantization parameters attached, *"compressing the entire output range into a ~1-unit sliver"* and producing "silently dead outputs" ([community 19705](https://community.hailo.ai/t/dfc-3-33-silent-16-bit-output-demotion-produces-inconsistent-hefs-runtime-demux-errors-stale-dequantization-params/19705)).
That is a very good mechanical description of "scores collapse with no error" — but it is triggered by *requesting* 16-bit outputs via `quantization_param`, which this repo never does.
Listed so it can be ruled out deliberately: on the device, `hailortcli parse-hef` plus the stream quant infos will show whether any output stream is UINT8 carrying an impossible zero-point (~18000–30000).

### One measurement-provenance flag

The on-chip NMS config sets `nms_scores_th = 0.20`, and HailoRT drops every candidate whose class score is `< nms_score_th` before it ever reaches the output buffer (source: `extract_detections`, cited above).
So "scores collapsed to below 0.2" cannot have been observed *at the HEF output* — anything emitted was by construction ≥ 0.2.
Either the reported values were sitting just above 0.2 (consistent with a collapse into the threshold floor), or they were read from raw tensors / a different threshold path.
Worth pinning down before ranking anything further, in the spirit of this repo's provenance gate.

---

## 1. `model_optimization_flavor` in full

Source for this section: [RidgeRun's Hailo model-scripts page](https://developer.ridgerun.com/wiki/index.php/Hailo/Hailo-8/AI_Software_and_Tools/Hailo_Model_Scripts), which mirrors the gated DFC model-script reference, cross-checked against Hailo community quotes. The gated DFC 3.33.1 User Guide could not be read directly, so *version-specific* drift in these tables is **UNVERIFIED**.

### Parameters

| Parameter | Values | Meaning |
|---|---|---|
| `optimization_level` | `-100`, `0`, `1`, `2`, `3`, `4` | How aggressively accuracy-recovery algorithms run. Higher = better accuracy, more time, more resources. |
| `compression_level` | `0`–`5` | Fraction of weights pushed to 4-bit. Higher = better FPS, needs a high optimization level to pay for the accuracy. |
| `batch_size` | int | Batch size used by the optimization algorithms; documented via the example `model_optimization_flavor(optimization_level=2, batch_size=4)`. |

Whether DFC 3.33.1 accepts further keys on this command is **UNVERIFIED**.

### `optimization_level` → algorithms and calibration expectation

| Level | Algorithms enabled | Calibration images the level itself expects |
|---|---|---|
| `-100` | nothing; all algorithms disabled | — |
| `0` | Equalization | range collection only |
| `1` | Equalization + Iterative Bias Correction (IBC) | range collection only |
| `2` | Equalization + **Finetune** — 4 epochs, **1024 images** | 1024 |
| `3` | Equalization + **AdaRound** — 320 epochs, 256 images, all layers | 256 |
| `4` | Equalization + **AdaRound** — 320 epochs, **1024 images**, all layers | 1024 |

The documented optimization-level ↔ calibration-set relationship is therefore *direct and mechanical*: levels 2 and 4 name 1024 images because those algorithms **train on** that many samples; level 3 names 256.
This is the concrete reason "calib ≥ 1024" is attached to opt-level 2 in this repo's comments, and it is correct.

Two behaviours that matter more than the table:

- **Levels above 0 want a GPU.** Without one: `[warning] Reducing optimization level to 0 (the accuracy won't be optimized and compression won't be used) because there's no available GPU`, alongside `[warning] Running model optimization with zero level of optimization is not recommended for production use` ([community 18264](https://community.hailo.ai/t/problem-wigh-gpu-on-hailo-warning-reducing-optimization-level-to-0-the-accuracy-won-t-be-optimized-and-compression-won-t-be-used-because-there-s-no-available-gpu/18264), [community 9429](https://community.hailo.ai/t/optimiziation-warnings-meaning/9429)). For a Colab-based pipeline this means the *effective* optimization level is a runtime property of the session, not of the config — the log is the only place it is knowable.
- **Level ≥ 2 turns on the layer-analysis checker by default.** `checker_cfg` is "enabled by default at optimization level ≥ 2" (RidgeRun), and Hailo staff confirm "simple LAT is automatically enabled when using `optimization_level > 1`, with results available in the profiler's Accuracy section" ([community 10895](https://community.hailo.ai/t/problem-with-noise-analysis-of-python-api/10895)). So opt-2 already produces the per-layer SNR data needed for §4 — for free.
- **Higher is not safer.** One user reported optimization level 4 causing outright detection failures and settled on level 1 ([community 9429](https://community.hailo.ai/t/optimiziation-warnings-meaning/9429)); another reported level 4 / AdaQuant failing with an internal error ([community 2205](https://community.hailo.ai/t/hailo-quantization-level-4-adaquant-fails-with-unexpected-error/2205)).

### `compression_level` → 4-bit weight ratio

| Level | Auto 4-bit weight ratio |
|---|---|
| `0` | none |
| `1` | 0.2 (20% of weights, if the network is large enough) |
| `2` | 0.4 |
| `3` | 0.6 |
| `4` | 0.8 |
| `5` | 1.0 |

This repo already pins `compression_level=0`, which is the right call for an accuracy-critical detector.
It matters: Hailo staff diagnosing a YOLO recall drop found the user's config had applied `compression_level=1` and told them to *"try forcing compression_level to 0 using the following command in the model script: `model_optimization_flavor(compression_level=0)`"* ([community 15321](https://community.hailo.ai/t/yolo-recall-degradation-after-compiling-to-hef/15321)).
Note that a community log shows `[info] Assigning 4bit weights to layer ...` appearing at optimization level 2 ([community 9429](https://community.hailo.ai/t/optimiziation-warnings-meaning/9429)) — if that line ever shows up in *this* project's log despite `compression_level=0`, that is itself a finding worth chasing.

---

## 2. The full tunable ALLS surface relevant to a YOLO detector

Grouped by pipeline stage, as the DFC organises them. Source: [RidgeRun model-scripts page](https://developer.ridgerun.com/wiki/index.php/Hailo/Hailo-8/AI_Software_and_Tools/Hailo_Model_Scripts) unless noted.

### Stage A — full-precision / graph modification (runs before quantization)

| Command | What it does | When to tune it |
|---|---|---|
| `normalization(mean, std [, layer])` | Inserts an on-chip normalization layer. This repo: `normalization([0,0,0],[255,255,255])` = on-chip `/255`. | Always, and it must exactly mirror what training did. Moving it on-chip is what lets the edge send raw uint8. Getting mean/std wrong is a top-tier collapse cause. |
| `input_conversion(layer, conversion [, emulator_support=True])` | On-chip colour/format conversion: `bgr_to_rgb`, `rgb_to_bgr`, `yuv*_to_rgb/bgr`, `nv12_to_hailo_yuv`, `yuy2_to_hailo_yuv`, `i420_to_hailo_yuv`, `tf_rgbx_to_hailo_rgb`. | **Directly relevant here.** If the edge camera hands over BGR or NV12/YUY2, do the conversion on-chip instead of hoping the host does it. This is the structural fix for the rank-3 hypothesis. |
| `transpose(layer)` / `transpose()` | Transposes input connected components. | Layout mismatches between exporter and device. |
| `resize(layer, resize_shapes=[H,W], resize_method=bilinear, engine=nn_core)` | On-chip resize of an input/output tensor. | When the camera resolution differs from the network input and you want the resize on-chip. |
| `change_output_activation(layer, activation)` | Replaces the activation on an output layer. | **Mandatory for YOLOv8/YOLOv11 with on-chip NMS**: the Model Zoo `yolov11s.alls` applies `sigmoid` to all three classification convs. See §5. |
| `logits_layer(layer, softmax\|argmax, axis)` | Appends a logits layer. | Classification heads; not used for detection. |
| `set_seed(seed=N)` | Global RNG seed. | Reproducibility — worth adding to this pipeline, because level-2 finetune is stochastic and "recompiling fixed it" has already happened once here. |
| `remove_node(layer)` | Deletes a layer. | Trimming unsupported tail ops instead of re-exporting. |

### Stage B — pre-quantization optimization

| Command | What it does | When to tune it |
|---|---|---|
| `pre_quantization_optimization(weights_clipping, layers=…, mode=disabled\|manual\|percentile\|mmse\|mmse_if4b, clipping_values=[…])` | How weight outliers are clipped before range fitting. Default `mmse_if4b`. | Layers with heavy-tailed weights; mostly matters once 4-bit is in play. |
| `pre_quantization_optimization(activation_clipping, layers=…, mode=disabled\|manual\|percentile, clipping_values=[…], recollect_stats=bool)` | Clips activation ranges. Disabled by default. | **The documented workaround for wide-range detection heads** — the DFC-3.33 16-bit-demotion thread recommends "keep all outputs 8-bit and recover accuracy with manual activation clipping" ([community 19705](https://community.hailo.ai/t/dfc-3-33-silent-16-bit-output-demotion-produces-inconsistent-hefs-runtime-demux-errors-stale-dequantization-params/19705)). |
| `pre_quantization_optimization(resolution_reduction, shape=[H,W], interpolation=…)` | Runs optimization at reduced spatial resolution. | Speeding up optimization; not for accuracy. |
| `pre_quantization_optimization(global_avgpool_reduction, layers=…, division_factors=[…])` | Shrinks global-avgpool spatial dims. | Classification backbones. |

### Stage C — quantization / precision control

| Command | What it does | When to tune it |
|---|---|---|
| `quantization_param(layer(s), precision_mode=a8_w8\|a8_w4\|a16_w16)` | Per-layer precision override. `a8_w8` is the default; `a16_w16` is 16-bit activations+weights and is supported on a documented list of layer types including **Convolution and Output Layer**. | **The standard first remedy for a quantization-sensitive head.** Hailo staff advice for a YOLO recall drop: *"try setting the model's outputs to 16 bits. This may help with the accuracy"* ([community 15321](https://community.hailo.ai/t/yolo-recall-degradation-after-compiling-to-hef/15321)). Caveat: DFC 3.33 has the silent-demotion bug above, so verify with `hailortcli parse-hef` that you got what you asked for. |
| `quantization_param(layer(s), force_range_out=[lo, hi])` | Forces the output range of a layer instead of fitting it from calibration. | Pinning a classification head to `[0.0, 1.0]` — seen in a real user ALLS as `quantization_param([conv64, conv77, conv89], force_range_out=[0.0, 1.0])` ([community 18411](https://community.hailo.ai/t/custom-yolo-model-missed-detections-on-hailo8/18411)). Staff in that thread warn: *do not apply both `change_output_activation` and `force_range_out` to the same layers.* |
| `model_optimization_config(compression_params, auto_16bit_weights_ratio=…)` | Fraction of weights auto-promoted to 16-bit. | Global accuracy/latency trade. |
| `model_optimization_config(calibration, batch_size=…, calibset_size=…)` | Calibration batch size and the number of samples used. | Raising the calibration set without changing the caller's array; Hailo staff suggested `model_optimization_config(calibration, calibset_size=2048)` to a user whose 64-image calib had broken detection ([community 18411](https://community.hailo.ai/t/custom-yolo-model-missed-detections-on-hailo8/18411), [community 11820](https://community.hailo.ai/t/model-script-documentation/11820)). |
| `model_optimization_config(checker_cfg, policy=…, dataset_size=…, analyze_mode=simple\|advanced, batch_norm_checker=bool)` | The Layer Analysis / noise checker. Enabled by default at optimization level ≥ 2. | Turn `analyze_mode=advanced` on when you need per-layer rather than whole-model noise. See §4. |

### Stage D — post-quantization optimization

| Command | Key parameters (defaults) | What it does / when |
|---|---|---|
| `post_quantization_optimization(bias_correction, policy=enabled\|disabled\|allowed, layers=…, cache_compression=…)` | default `disabled`, on by policy at level ≥ 1 | Iterative Bias Correction. Recommended when the model has small kernels or depthwise layers — which YOLO backbones have. |
| `post_quantization_optimization(finetune, …)` | `policy`, `dataset_size=1024`, `epochs=4`, `batch_size`, `learning_rate`, `def_loss_type=l2rel` (`ce\|l2\|l2rel\|cosine`), `loss_layer_names`, `loss_types`, `loss_factors`, `native_layers`, `native_activations=disabled`, `val_images=4096`, `val_batch_size=128`, `stop_gradient_at_loss`, `force_pruning=True` | Knowledge-distillation fine-tuning of the quantized net against the FP32 teacher. **This is what `optimization_level=2` switches on**, and it is the rank-1 suspect. Exposing `epochs`, `dataset_size` and `learning_rate` explicitly is how you make level 2 debuggable instead of magic. |
| `post_quantization_optimization(train_encoding, …)` | `dataset_size=1024`, `epochs=8`, plus the same loss knobs | Trains the quantization encodings. |
| `post_quantization_optimization(adaround, …)` | `policy=disabled`, `learning_rate=0.001`, `batch_size=32`, `dataset_size=1024`, `epochs=320`, `warmup=0.2`, `weight=0.01`, `train_bias=True`, `bias_correction_count=64`, `mode=train_4bit\|train_all`, `b_range=[20,2]`, `decay_start=0`, per-layer overrides | Learns per-weight rounding. What levels 3/4 switch on. Expensive; usually for 4-bit. |
| `post_quantization_optimization(mix_precision_search, policy=enabled, dataset_size=16, snr_cap=140, comprecision_metric=bops, optimizer=linear\|pareto, …)` | | Searches per-layer precision by SNR. The automated version of "force 16-bit on the sensitive layer". |

### Stage E — NMS and compilation

| Command | Notes |
|---|---|
| `nms_postprocess('config.json', meta_arch=…, engine=nn_core\|cpu\|auto [, bbox_decoding_only=True])` | Full treatment in §5. Documented `meta_arch` support: YOLOv5, YOLOv6, YOLOv7, YOLOv8, YOLOv5-Seg, YOLOX, CenterNet, SSD. Documented defaults: `nms_scores_th` 0.3, `nms_iou_th` 0.6 (CPU mode). |
| `performance_param(compiler_optimization_level=0\|1\|2\|max)` / `performance_param(optimize_for_power=True)` | Compiler search effort (`0` = first feasible, `1` = default, `2`/`max` = exhaustive) — pure FPS/allocation, no accuracy effect. `yolov8s.alls` ships `optimize_for_power=True`. |
| `allocator_param(...)` | Allocation tweaks; `yolov11n.alls` ships `allocator_param(width_splitter_defuse=disabled)`. Needed when allocation fails, not for accuracy. |
| `platform_param(targets=[ethernet])`, `platform_param(hints=[low_pcie_bandwidth])` | Deployment-transport tuning. |

### Suggested UI knob set for the spec

Ordered by how often they are the answer to an accuracy problem, which is the order a UI should present them.

1. `calib_n` **and** `calib_source` (dataset split vs. an explicit edge-frame directory) — the highest-leverage pair, and currently the one the pipeline defaults badly on.
2. `optimization_level` (0/1/2), with the level-2 sub-knobs surfaced rather than hidden: `finetune.epochs`, `finetune.dataset_size`, `finetune.learning_rate`.
3. `compression_level` — pin to 0, expose read-only unless someone deliberately wants FPS.
4. Output precision: force `a16_w16` on the three cls output layers (and/or the reg layers), as a boolean.
5. `change_output_activation` sigmoid on cls heads — a boolean that should default to **on**, with an assertion that it took effect.
6. `input_conversion` (none / `bgr_to_rgb` / NV12 / YUY2) — makes the edge's real pixel format part of the compile contract.
7. NMS: `nms_scores_th`, `nms_iou_th`, `max_proposals_per_class`, `classes`, `regression_length`, `engine`.
8. `set_seed` — so a "recompile fixed it" outcome becomes reproducible evidence instead of folklore.
9. Diagnostics toggles: run emulator FP-vs-INT8 comparison, run `analyze_noise`, emit the profiler HTML. These should be *on by default* for any production compile.

---

## 3. Calibration set requirements

### Size

- Hailo Model Zoo, on the optimization step: *"it is recommended to run this step on a GPU machine with dataset size of at least 1024 images"* ([OPTIMIZATION.rst](https://github.com/hailo-ai/hailo_model_zoo/blob/master/docs/OPTIMIZATION.rst)).
- Ultralytics' Hailo exporter, which drives DFC 3.x for YOLO: *"Use at least 1,024 calibration images for best accuracy"*, and it *"forces DFC optimization level 2"* ([Ultralytics](https://docs.ultralytics.com/integrations/hailo)).
- The level-2 and level-4 algorithm defaults are literally defined on 1024 samples (§1), so 1024 is not a superstition — it is the `dataset_size` those algorithms will train on.
- One secondary mirror of the DFC guide states the requirement more strongly: *"the size of the required calibration data is typically in the order of several 1000s of samples"* ([community 11820](https://community.hailo.ai/t/model-script-documentation/11820)). Treat the exact wording as secondary.
- Real cases: 64 images broke a detector, 2048 fixed it ([community 18411](https://community.hailo.ai/t/custom-yolo-model-missed-detections-on-hailo8/18411)). This repo's own history records `calib 645 < 1024` at opt-2 as part of a dead-HEF root cause.

### Domain representativeness

Is training-set calibration *forbidden*? **No — it is Hailo's own documented default.**
*"Typically, you will use images from the dataset used for training"* ([Macnica](https://www.macnica.co.jp/en/business/semiconductor/articles/hailo/145097/)); the JeVois Hailo guide uses "approximately 100 sample images from validation sets" and only notes that the data should be relevant to the training domain ([JeVois](https://www.jevois.org/doc/UserDNNspu.html)).

Is it *sufficient*? **No, and the strongest guidance is explicit about it.**
Ultralytics: *"Calibration images should represent the lighting, viewpoints, objects, and backgrounds expected in production"* and — the operative sentence for this project — *"A small in-domain set beats a large out-of-domain one"* ([Ultralytics](https://docs.ultralytics.com/integrations/hailo)).
The mechanism is simple and documented: calibration exists to measure the *dynamic range of activations* so ranges can be fitted; a distribution that does not cover deployment conditions yields ranges that clip or under-resolve real inputs.

**Is training-set-sampled calibration a known cause of accuracy collapse?**
Documented fact: **calibration sets that are too small or insufficiently diverse are a repeatedly confirmed cause of severe post-quantization degradation** in the Hailo forum, and increasing size + diversity is staff's standard first remedy.
Documented fact: no Hailo source I could reach says "sampling calibration from the training split causes collapse".
Inference: for this project the training corpus is itself largely harvested edge-camera frames, so the *domain* is probably fine; the sharper defects in `build_calib_dir` are (a) it takes `imgs[:n]` from a sorted glob rather than sampling, so diversity is whatever the filename ordering happens to give, and (b) at optimization level 2 the calibration set is a *training* set for the finetune, which raises the cost of any bias in it. Both are worth fixing regardless of what caused this incident.
Note the pipeline is already honest about this: `build_calib_dir`'s own docstring says *"Production quant should override with real edge frames (>=1024)"*, and `train_for_run.py` comments that opt-level-2's extra correction is exactly what needs real frames to calibrate against.

---

## 4. Diagnosing a post-quantization accuracy collapse

### 4a. The emulator FP-vs-INT8 comparison — do this before every deploy

This is the highest-value gate and it runs entirely inside the Colab session, with no device involved.
The DFC exposes three inference contexts through `ClientRunner` ([community 4962](https://community.hailo.ai/t/difference-output-from-har-ubuntu-vs-hef-hailo8l-raspberry-pi/4962), [community 144](https://community.hailo.ai/t/using-mixed-mode-fp-quant-for-network-evaluation/144)):

- `InferenceContext.SDK_NATIVE` — the parsed model as-is; should match the original framework outputs. Proves *parsing* is right.
- `InferenceContext.SDK_FP_OPTIMIZED` — after full-precision optimization (so after `normalization`, `change_output_activation`, equalization). Proves the *graph modifications* are right.
- `InferenceContext.SDK_QUANTIZED` — the quantized model in the emulator. Proves *quantization* is right.

```python
import numpy as np
from hailo_sdk_client import ClientRunner, InferenceContext

runner = ClientRunner(har="yolov11s_sack_quantized.har")
probe = calib[:16]                     # same preprocessing as load_calib(): RGB, 0-255 float, letterboxed

with runner.infer_context(InferenceContext.SDK_FP_OPTIMIZED) as ctx:
    fp = runner.infer(ctx, probe)
with runner.infer_context(InferenceContext.SDK_QUANTIZED) as ctx:
    q8 = runner.infer(ctx, probe)

# With on-chip NMS the output is the HailoRT NMS format; without it, per-scale tensors.
# Either way: compare the max class score per frame, FP vs INT8, on the SAME frames.
print("fp  max:", np.max(fp), " int8 max:", np.max(q8))
```

Interpretation, and this is the whole point of the gate:

- FP good, INT8 collapsed → the damage is inside `optimize()`. Suspect calibration and the optimization level. Nothing about HailoRT, the HEF, or the edge is implicated.
- FP already collapsed → the damage is in the graph modification stage. Suspect `normalization`, the end-node cut, or a missing/duplicated activation.
- FP and INT8 both good but the device is collapsed → the damage is after compilation. Suspect the DFC↔HailoRT version pairing, the NMS config, or the edge's preprocessing (channel order, scaling, letterbox).

That three-way split is the cheapest way to turn "the HEF is bad" into one of three much smaller problems.
Note that emulator-good / device-bad is a real and reported outcome, so the emulator is a necessary but not sufficient gate ([community 1699](https://community.hailo.ai/t/can-detect-objects-well-with-emulator-in-sdk-quantized-mode-but-missed-some-objects-when-compile-and-run-with-hef-in-hailo8/1699), [community 13760](https://community.hailo.ai/t/reconciling-different-outputs-between-quantized-har-and-compiled-hef/13760)).

### 4b. Which layer destroys the accuracy — Layer Analysis Tool / noise analysis

Python API ([community 10895](https://community.hailo.ai/t/problem-with-noise-analysis-of-python-api/10895)):

```python
runner.analyze_noise(calib_dataset, batch_size=2, data_count=32)
```

CLI ([RidgeRun commands page](https://developer.ridgerun.com/wiki/index.php/Hailo/Hailo-8/AI_Software_and_Tools/Hailo_Commands)):

```
hailo analyze-noise <quantized.har> --data-path <dataset> [--batch-size N] [--data-count N] [--analyze-mode simple|advanced]
```

- `--analyze-mode simple` analyses the fully quantized model (whole-network SNR); `advanced` analyses **layer by layer** — that is the mode that names the guilty layer.
- Output is signal-to-noise ratio in dB per layer, surfaced in the profiler's **Accuracy** section; the tool also writes a JSON that the HTML profiler consumes to unlock that tab.
- Hailo staff caution, verbatim: *"I wouldn't recommend you run the full LAT as it is only useful in very specific cases in advanced debugging of degradation. The simple LAT should be enough if you are interested in SNR."* There is also a **known DFC bug** in full (advanced) noise analysis producing dimension-mismatch errors such as `Dimensions must be equal, but are 768 and 780`, confirmed as under investigation.
- Because simple LAT is auto-enabled at `optimization_level > 1`, an opt-2 compile has already produced this data — read the profiler instead of re-running the analysis.
- This is also the reason `compile_clientrunner.py`'s header lists "Layer Noise Analysis crashes on full LAT" as DFC trap #2. That is a real, vendor-acknowledged bug, not a local quirk.

### 4c. Profiler

```
hailo profiler <model.har>
```

Run on a **quantized** HAR, the HTML report includes model and accuracy information, and it now displays a quick version of the Layer Analysis Tool as an **Accuracy tab** ([community 2722](https://community.hailo.ai/t/hailo-profiler-usage/2722), [RidgeRun](https://developer.ridgerun.com/wiki/index.php/Hailo/Hailo-8/AI_Software_and_Tools/Hailo_Commands)).
A separate `hailo runtime-profiler <trace>` renders a device trace captured by `hailortcli` — performance, not accuracy.

### 4d. Recover the *effective* model script

```
hailo har extract <compiled.har> --auto-model-script-path auto_model_script_file.alls
```

This is the definitive answer to "did DFC actually apply what I wrote, and what did it add on its own?" — including whether a sigmoid was auto-inserted on the cls heads ([RidgeRun](https://developer.ridgerun.com/wiki/index.php/Hailo/Hailo-8/AI_Software_and_Tools/Hailo_Model_Scripts)).
For a mid-pipeline check, `runner.get_hn()` gives the HN JSON — which this repo already parses in `derive_bbox_decoders()`, so reading the activation field of the cls output layers is a two-line addition.

### 4e. On-device checks

- `hailortcli parse-hef <file.hef>` — stream names, shapes, and precisions; compare against what the ALLS asked for. This is the check that catches the DFC-3.33 silent 16-bit demotion.
- `InferModel::InferStream::get_quant_infos()` — zero-points around 18000–30000 on a UINT8 stream are impossible and indicate stale dequantization params ([community 19705](https://community.hailo.ai/t/dfc-3-33-silent-16-bit-output-demotion-produces-inconsistent-hefs-runtime-demux-errors-stale-dequantization-params/19705)).
- `hailortcli run <file.hef>` — proves load + throughput, says nothing about accuracy.

### 4f. Known causes of *total* score collapse (as opposed to a few mAP points)

Ordered by how often they are the confirmed answer in Hailo's own forum.

1. **Channel order — RGB vs BGR.** Confirmed root cause twice in the threads cited above. Ultralytics-trained models take RGB and do the BGR→RGB flip inside their own preprocessor, so a bare HEF fed OpenCV/picamera2 output gets swapped channels. Symptom: uniform confidence collapse with boxes still landing roughly in the right places.
2. **Normalization mismatch or double normalization.** The ALLS `normalization` and the host preprocessing must partition the work exactly once. On-chip `/255` + host `/255` = inputs in `[0, 0.004]`; on-chip nothing + host nothing = inputs in `[0,255]` into a `[0,1]` network. Community diagnosis of an all-scores-at-floor case: *"typically indicates a preprocessing mismatch (BGR vs RGB, or /255 normalization issues)"*.
3. **Calibration set too small or non-representative.** 64 → 2048 images turned a dead fire detector into a working one.
4. **`compression_level > 0` assigning 4-bit weights.** Staff's first suggestion on a recall regression.
5. **Missing / conflicting output activation on the classification heads.** The Model Zoo recipe requires `change_output_activation(cls_conv, sigmoid)`; staff separately warn against applying both `change_output_activation` and `force_range_out` to the same layer.
6. **Wrong end-node cut, or wrong layer names in `bbox_decoders`.** Cutting after reshape/concat ops or naming the wrong convs yields `NMSConfigPostprocessException` at compile time, or structurally wrong outputs. This repo derives both from the graph, which is the right defence.
7. **DFC 3.33 silent 16-bit output demotion** → dequantization params that compress the output range "into a ~1-unit sliver", i.e. silently dead outputs with no error.
8. **Architecture-level INT8 sensitivity in YOLO11 specifically.** Ultralytics documents an "attention penalty": the attention blocks in the YOLO11 backbone are structurally INT8-sensitive on Hailo-8/8L with DFC 3.33, affecting YOLO11 more than YOLOv8, with roughly 96% INT8 retention for YOLO11n and *"quantization also re-ranks roughly 20% of detections"* ([Ultralytics](https://docs.ultralytics.com/integrations/hailo)). This predicts a few points of degradation and confidence re-ranking — **not** a collapse — but it is the documented reason a YOLOv11 detector needs a wider confidence margin on Hailo than its FP32 numbers suggest.

---

## 5. `nms_postprocess` correctness for a custom 2-class YOLOv11

This section is grounded in the **HailoRT v4.20.0 source** — the code that actually runs on the Pi — rather than on documentation, because that source is public and definitive: [`yolov8_post_process.hpp`](https://github.com/hailo-ai/hailort/blob/v4.20.0/hailort/libhailort/src/net_flow/ops/yolov8_post_process.hpp), [`yolov8_post_process.cpp`](https://github.com/hailo-ai/hailort/blob/v4.20.0/hailort/libhailort/src/net_flow/ops/yolov8_post_process.cpp), [`nms_op_metadata.hpp`](https://github.com/hailo-ai/hailort/blob/v4.20.0/hailort/libhailort/src/net_flow/ops_metadata/nms_op_metadata.hpp).

### Is `meta_arch=yolov8` correct for YOLOv11?

**Yes — documented fact.** Hailo's own `yolov11n.alls` and `yolov11s.alls` both use `nms_postprocess(".../yolov11{n,s}_nms_config.json", meta_arch=yolov8, engine=cpu)`.
YOLOv11's detection head keeps the YOLOv8 DFL structure (64-channel box branch = 4 × 16 bins, plus an `nc`-channel class branch), so the same decoder applies.
This repo's `detect_head()` reasoning — "YOLOv11 emits a 64-ch DFL box (regression_length=16) that the on-chip `meta_arch=yolov8` NMS can decode; YOLO26 emits a 4-ch direct box, so the yolov8 decode is WRONG for it" — is correct and matches the source.

### Field-by-field

| Field | Repo value | What the runtime does with it (source-verified) |
|---|---|---|
| `nms_scores_th` | 0.20 | `nms_score_th`. Compared **directly** against the dequantized class-tensor value. Candidates below it are dropped inside `extract_detections`, before the output buffer — so nothing below this threshold can ever be observed at the HEF output. DFC's documented default is 0.3. |
| `nms_iou_th` | 0.70 | IoU threshold for suppression. DFC's documented default is 0.6 in CPU mode. |
| `image_dims` | `[640, 640]` | `image_height` / `image_width`, used as the divisor in `decode()`: boxes come out **normalized to `[0,1]`**, as `x_center = (col+0.5)*stride/image_width` etc. Wrong values ⇒ boxes scaled wrong; scores untouched. |
| `max_proposals_per_class` | 50 | Per-class output cap; for `HAILO_NMS_RESULT_ORDER_BY_CLASS`, total capacity = `max_proposals_per_class × number_of_classes`. It sizes the output buffer, so it is a **truncation** limit: too low silently drops the tail of a busy frame. The Model Zoo YOLOv8 configs use 100. For a 2-class sack line 50 is probably fine, but it is a real cap worth stating in the contract. |
| `classes` | 2 | `number_of_classes`. Used by `validate_classes_buffer_size` to compute the expected cls buffer size — so a **mismatch is a hard runtime error**, `"cls <layer> buffer_size should be X, but is Y"`, not a silent accuracy loss. Good news: this cannot be the cause of a quiet collapse. |
| `regression_length` | 16 | The DFL bin count. `get_bbox()` reshapes the reg tensor's features into 4 vectors of `features/4`, runs **softmax** over each, then a dot product with `0..15`. So `regression_length` must equal `reg_channels/4` (64/4 = 16 for YOLOv8/v11). The runtime also validates `reg features % 4 == 0`. |
| `background_removal` | `false` | Drops one class as background; `background_removal_index` says which, and the runtime notes it "will always be the first or last index". `false` is correct for YOLOv8/v11, which have **no objectness and no background class** (`NO_OBJECTNESS = 1`, `CLASSES_START_INDEX = 0` in the source). |
| `bbox_decoders` | derived from HN | Per-scale `{name, stride, reg_layer, cls_layer}`. `stride` drives both the grid walk and the `decode()` scaling. This repo derives them from the parsed HN by channel count (`>=16` ⇒ reg) and spatial size (`size//H` ⇒ stride), which is the right approach — export-time conv renumbering cannot break it. |

### Fields the repo does **not** set, and whether they matter

- **`change_output_activation(<cls_conv>, sigmoid)` — the significant omission.** Not an `nms_postprocess` field, but part of the same contract. The runtime applies **no** sigmoid to the class tensor (verified in `extract_detections`: the score is just `dequantize_output(cls_data[...], cls_quant_info)`), and Hailo's `yolov11s.alls` supplies the sigmoid explicitly. Whether DFC 3.33 inserts it automatically when `meta_arch=yolov8` is **UNVERIFIED**; §4d gives the two-minute check. Do not ship a compile without confirming it one way or the other.
- `background_removal_index` — present in the Model Zoo configs; irrelevant while `background_removal=false`.
- `cross_classes` — class-agnostic NMS. When true the runtime keeps only the argmax class per cell (a pre-NMS optimization); when false/absent a cell can emit one detection per class above threshold. For person+sack, where the two can genuinely overlap, leaving it off is the safer default — worth making an explicit decision rather than a default.
- `bbox_only` / `bbox_decoding_only=True` — decode boxes on-chip but skip NMS. Useful if the edge wants to run its own NMS; not what this pipeline wants.
- `order_type` — output ordering (`BY_CLASS` vs by score). Affects how the edge parses the buffer.
- `engine` — set to `cpu` here, matching the Model Zoo. `nn_core` moves NMS onto the accelerator; `auto` lets DFC choose.

### What a wrong `regression_length` or decoder-to-stride mapping actually looks like

**Documented fact, from the source:** the score written into every detection comes *only* from the cls tensor (`bbox.score = class_confidence`), and `regression_length`, `stride` and `image_dims` are used *only* inside the DFL softmax/dot-product and the coordinate arithmetic.
Therefore:

- **Wrong `regression_length`, or a decoder pointing at the wrong stride** ⇒ **wrong boxes with unchanged, healthy scores**: correct-looking confidences on boxes that are the wrong size or offset from the object, typically consistently wrong per scale. It cannot produce a score collapse.
- **`reg_layer` and `cls_layer` swapped** in a decoder ⇒ the runtime tries to read a 64-channel tensor as `classes`-wide (and vice-versa), the buffer-size validation fails, and you get a hard `HAILO_INVALID_ARGUMENT` at load — a loud failure, not a quiet one.
- **Score collapse therefore points at the classification path**: the cls tensor's activation and its quantization range, i.e. calibration, optimization level, output precision, or a missing sigmoid — not at the box decoder.

That is a useful elimination: the observed symptom rules the entire `bbox_decoders` / `regression_length` family *out*.

---

## 6. Version compatibility: DFC 3.33.1 → HailoRT 4.20.0

**Documented fact: this pairing is not the aligned one.**
Hailo ships quarterly suites in which all component versions are aligned, and the guidance is that "Hailo SW products are compatible with each other on specific versions" and should be upgraded together ([Hailo AI SW Suite 2024-10 release notes](https://advdownload.advantech.com/productfile/Downloadfile4/1-2NYR3X2/what_is_new_in_hailo_ai_sw_suite_2024-10.pdf)).
The Model Zoo release notes give the pairings ([releases](https://github.com/hailo-ai/hailo_model_zoo/releases)):

| Model Zoo | Dataflow Compiler | HailoRT |
|---|---|---|
| v2.14 | 3.30.0 | **4.20.0** |
| v2.15 | 3.31.0 | 4.21.0 |
| v2.16 | 3.32.0 | 4.22.0 |
| v2.18 | **3.33.1** | not stated on the releases page; Ultralytics documents DFC 3.33 validated with HailoRT 4.23 — **UNVERIFIED** as the official pairing |

Hailo staff, verbatim: *"if you're using HailoRT 4.20, make sure you're compiling with DFC 3.30 for full compatibility"* ([community 13704](https://community.hailo.ai/t/hef-version-does-not-match/13704)).
And a user compiling a custom YOLOv8 with **exactly DFC 3.33.1 for HailoRT 4.20.0** hit a firmware error (`context_switch_task_status_received_invalid_application_count`), was pointed at the "Release Versions Compatibility" section of the AI Software Suite User Guide, and resolved it by moving to the matrix-correct DFC ([community 19032](https://community.hailo.ai/t/yolov8-custom-model-hef-compilation-error-on-hailo-8-with-hailort-4-20-0/19032)).

**What breaks when the pairing is wrong:** HEF-version refusals (`HEF version does not match`), firmware/context-switch errors at load or during inference, and driver/runtime mismatches (the same thread notes a 4.19 driver under a 4.20 runtime as a separate mismatch to check).
These are **loud** failures. I found no documented case of a version mismatch causing a *graded accuracy* loss on a HEF that loads and runs correctly — so the mismatch is unlikely to explain this incident, and should not be treated as the fix.

**Recommendation for the spec:** pin the pair explicitly and record both in `meta.yaml` — either compile with DFC **3.30.0** for the current HailoRT **4.20.0** fleet, or upgrade the fleet to the HailoRT that ships with 3.33.1 and re-verify. Running an off-matrix pair "because it worked" is an accepted risk, not a supported configuration, and it should be written down as such. Note the repo's `compile_clientrunner.py` already flags the related trap that `hailo_platform` (HailoRT) is absent from the DFC venv, so the compile side cannot self-verify the runtime — the device is the only place this can be checked.

---

## Appendix — a pre-deploy diagnostic cell for the Colab flow

Everything below runs in the DFC venv immediately after `runner.optimize(calib)` and before `runner.compile()`.
None of it requires a device.

```python
# 0) What did DFC actually apply? (catches auto-inserted / missing sigmoid, silent level changes)
import json
hn = json.loads(runner.get_hn()) if isinstance(runner.get_hn(), str) else runner.get_hn()
for name, layer in hn["layers"].items():
    if layer.get("type") == "output_layer":
        src = layer["input"][0]
        print(src, hn["layers"][src].get("activation"), hn["layers"][src]["output_shapes"][0])

# 1) FP-vs-INT8 on identical frames — the gate that localises the damage
from hailo_sdk_client import InferenceContext
import numpy as np
probe = calib[:16]
with runner.infer_context(InferenceContext.SDK_FP_OPTIMIZED) as ctx:
    fp = runner.infer(ctx, probe)
with runner.infer_context(InferenceContext.SDK_QUANTIZED) as ctx:
    q8 = runner.infer(ctx, probe)
print("FP max", float(np.max(fp)), "INT8 max", float(np.max(q8)))

# 2) Per-layer SNR, if (1) says the quantization is the problem
runner.analyze_noise(probe, batch_size=2, data_count=16)   # simple mode; 'advanced' has a known DFC bug
```

Plus, outside Python:

```bash
hailo profiler yolov11s_sack_quantized.har      # HTML report, Accuracy tab = layer SNR
hailo har extract yolov11s_sack_compiled.har --auto-model-script-path effective.alls
hailortcli parse-hef yolov11s_sack.hef          # on the device: stream precisions vs. what was requested
```

And three log strings worth asserting on in every compile, because each silently changes what you shipped:

- `Reducing optimization level to 0` — the requested optimization level did not happen.
- `Assigning 4bit weights to layer` — 4-bit compression happened despite `compression_level=0`.
- `Using dataset with N entries for calibration` — the calibration count DFC actually used, which is not necessarily `calib_n`.

---

## Sources

- [Hailo Model Zoo — `yolov11s.alls`](https://github.com/hailo-ai/hailo_model_zoo/blob/master/hailo_model_zoo/cfg/alls/generic/yolov11s.alls) · [`yolov11n.alls`](https://github.com/hailo-ai/hailo_model_zoo/blob/master/hailo_model_zoo/cfg/alls/generic/yolov11n.alls) · [`yolov8s.alls`](https://github.com/hailo-ai/hailo_model_zoo/blob/master/hailo_model_zoo/cfg/alls/generic/yolov8s.alls) · [`yolov8s_nms_config.json`](https://github.com/hailo-ai/hailo_model_zoo/blob/master/hailo_model_zoo/cfg/postprocess_config/yolov8n_nms_config.json)
- [Hailo Model Zoo — OPTIMIZATION.rst](https://github.com/hailo-ai/hailo_model_zoo/blob/master/docs/OPTIMIZATION.rst) · [releases (DFC/HailoRT pairings)](https://github.com/hailo-ai/hailo_model_zoo/releases)
- [HailoRT v4.20.0 — `yolov8_post_process.hpp`](https://github.com/hailo-ai/hailort/blob/v4.20.0/hailort/libhailort/src/net_flow/ops/yolov8_post_process.hpp) · [`yolov8_post_process.cpp`](https://github.com/hailo-ai/hailort/blob/v4.20.0/hailort/libhailort/src/net_flow/ops/yolov8_post_process.cpp) · [`nms_op_metadata.hpp`](https://github.com/hailo-ai/hailort/blob/v4.20.0/hailort/libhailort/src/net_flow/ops_metadata/nms_op_metadata.hpp)
- [RidgeRun — Hailo Model Scripts (ALLS reference mirror)](https://developer.ridgerun.com/wiki/index.php/Hailo/Hailo-8/AI_Software_and_Tools/Hailo_Model_Scripts) · [Hailo Commands (CLI reference mirror)](https://developer.ridgerun.com/wiki/index.php/Hailo/Hailo-8/AI_Software_and_Tools/Hailo_Commands) · [Hailo Dataflow Compiler overview](https://developer.ridgerun.com/wiki/index.php/Hailo/Hailo-8/AI_Software_and_Tools/Hailo_Dataflow_Compiler)
- [Ultralytics — Hailo export for YOLO](https://docs.ultralytics.com/integrations/hailo)
- [Hailo community 15321 — YOLO recall degradation after compiling to HEF](https://community.hailo.ai/t/yolo-recall-degradation-after-compiling-to-hef/15321)
- [Hailo community 18411 — Custom YOLO model missed detections on Hailo8](https://community.hailo.ai/t/custom-yolo-model-missed-detections-on-hailo8/18411)
- [Hailo community 10895 — Problem with noise analysis of Python API](https://community.hailo.ai/t/problem-with-noise-analysis-of-python-api/10895)
- [Hailo community 9429 — Optimization warnings meaning](https://community.hailo.ai/t/optimiziation-warnings-meaning/9429) · [18264 — Reducing optimization level to 0, no GPU](https://community.hailo.ai/t/problem-wigh-gpu-on-hailo-warning-reducing-optimization-level-to-0-the-accuracy-won-t-be-optimized-and-compression-won-t-be-used-because-there-s-no-available-gpu/18264)
- [Hailo community 19705 — DFC 3.33 silent 16-bit output demotion](https://community.hailo.ai/t/dfc-3-33-silent-16-bit-output-demotion-produces-inconsistent-hefs-runtime-demux-errors-stale-dequantization-params/19705)
- [Hailo community 19032 — YOLOv8 HEF compile error, DFC 3.33.1 vs HailoRT 4.20.0](https://community.hailo.ai/t/yolov8-custom-model-hef-compilation-error-on-hailo-8-with-hailort-4-20-0/19032) · [13704 — HEF version does not match](https://community.hailo.ai/t/hef-version-does-not-match/13704)
- [Hailo community 2722 — Hailo profiler usage](https://community.hailo.ai/t/hailo-profiler-usage/2722) · [144 — mixed-mode FP+QUANT evaluation](https://community.hailo.ai/t/using-mixed-mode-fp-quant-for-network-evaluation/144) · [4962 — HAR vs HEF output differences](https://community.hailo.ai/t/difference-output-from-har-ubuntu-vs-hef-hailo8l-raspberry-pi/4962) · [1699 — emulator good, HEF misses](https://community.hailo.ai/t/can-detect-objects-well-with-emulator-in-sdk-quantized-mode-but-missed-some-objects-when-compile-and-run-with-hef-in-hailo8/1699) · [13760 — reconciling quantized HAR vs HEF](https://community.hailo.ai/t/reconciling-different-outputs-between-quantized-har-and-compiled-hef/13760)
- [Hailo community 11820 — Model script documentation](https://community.hailo.ai/t/model-script-documentation/11820) · [2205 — level 4 / AdaQuant failure](https://community.hailo.ai/t/hailo-quantization-level-4-adaquant-fails-with-unexpected-error/2205)
- [Macnica — How to use the Dataflow Compiler](https://www.macnica.co.jp/en/business/semiconductor/articles/hailo/145097/) · [JeVois — converting networks for Hailo-8](https://www.jevois.org/doc/UserDNNspu.html)
- [Hailo Developer Zone DFC 3.33.0 documentation](https://hailo.ai/developer-zone/documentation/dataflow-compiler-v3-33-0/) — login-gated, could not be read; all DFC-guide claims above therefore rest on the mirrors and forum quotes cited inline.

*Loom Oracle (AI) · 2026-09-03*
