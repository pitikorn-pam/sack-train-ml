# 11 — Does DFC auto-insert the cls sigmoid, or must our ALLS emit it?

Type: task
Status: resolved
Blocked by: —

## Question

Raised by [02](./02-hailo-compile-params.md). Hailo's official `yolov11s.alls` carries three `change_output_activation(<cls_conv>, sigmoid)` lines. The ALLS this repo generates (`scripts/compile_clientrunner.py:198-216`) carries none. The YOLOv8 NMS op in HailoRT 4.20.0 applies no sigmoid itself, so the classification tensor reaching it must already hold probabilities — if DFC does not insert the activation for us, every HEF this repo has produced feeds raw logits into a threshold expecting probabilities.

This is a **fact to establish, not a decision to make**, and it needs a DFC environment (Colab), so it is a task rather than a research ticket.

**Now a ready-to-run notebook**, because no DFC environment was standing and the earlier snippet assumed one: [`notebooks/probe_cls_activation.ipynb`](../../../notebooks/probe_cls_activation.ipynb) builds the venv from the wheel in Drive, clones the repo and runs [`scripts/probe_cls_activation.py`](../../../scripts/probe_cls_activation.py).

The probe **imports the real recipe** from `compile_clientrunner.py` rather than restating it, so the answer describes the pipeline that actually runs rather than a copy that has drifted — the failure mode `compile_run.ipynb` already demonstrated.

It reads the output layers twice: after parse, and after `optimize()` — the stage where `change_output_activation` takes effect, which a parsed-only HAR would not reveal. Needs no device, no full compile and no calibration set; quantization quality is irrelevant to a question about the graph, so eight synthetic frames suffice. A second, independent reading comes from `hailo har extract --auto-model-script-path`, which recovers the model script DFC generated for itself.

**Original checklist** (kept for the record — needs Colab, since the DFC wheel is `linux_x86_64` and cannot run on an arm64 Mac):

```python
%%writefile /content/check_sigmoid.py
import glob, json, sys
from hailo_sdk_client import ClientRunner

pats = ['/content/**/*_quantized.har', '/content/drive/MyDrive/**/*_quantized.har',
        '/content/**/*_parsed.har',    '/content/drive/MyDrive/**/*_parsed.har']
hars = [p for pat in pats for p in sorted(glob.glob(pat, recursive=True))]
if not hars:
    sys.exit('no .har found — compile once first, or edit the globs above')
print('HAR:', hars[0])

runner = ClientRunner(har=hars[0])
hn = runner.get_hn()
hn = json.loads(hn) if isinstance(hn, str) else hn
for name, layer in hn['layers'].items():
    if layer.get('type') != 'output_layer':
        continue
    src = hn['layers'][layer['input'][0]]
    print(f"{layer['input'][0]:<55} activation={str(src.get('activation')):<10} shape={src['output_shapes'][0]}")
```

then

```python
!/content/hailo_venv/bin/python /content/check_sigmoid.py
```

**How to read it.** Six output layers print. The three whose last dimension equals the class count (**2**) are the classification heads; the three with **64** are the DFL box heads.

- cls heads show `sigmoid` → DFC inserts it. Hypothesis closed, the collapse investigation stays on `optimization_level`.
- cls heads show `linear` (or none) → DFC does **not** insert it, our ALLS must emit `change_output_activation(<cls_conv>, sigmoid)`, and every HEF this repo has produced has been feeding raw logits to a threshold that expects probabilities.

Cross-check, which also reveals anything else DFC applied on its own:

```bash
!/content/hailo_venv/bin/hailo har extract <parsed.har> --auto-model-script-path /content/effective.alls
!cat /content/effective.alls
```

Record the output verbatim in the answer — paraphrasing this one defeats its purpose.

**What the answer changes:** if DFC does *not* auto-insert it, the ALLS generator must emit those lines and [06](./06-fields-vs-escape-hatch.md) must treat output activation as part of the generated-parameter surface rather than something the compiler handles. If it does auto-insert, the hypothesis is closed and the collapse investigation keeps pointing at `optimization_level`.

Record the verbatim command output in the answer — this is exactly the kind of claim that must not be paraphrased.

## Answer

**DFC inserts the sigmoid itself. Our ALLS does not need `change_output_activation`, and the hypothesis is closed.**

Run on Colab (Tesla T4, DFC 3.33.1, Python 3.10) against **`f8f85a5d`** — the deployed production detector, not a stand-in. Verbatim, from applying the model script the pipeline actually generates:

```
--- output layers after parse (before any model script) ---
  probe/conv80                                   cls  channels=2    activation=None

--- model script applied (identical to the pipeline's) ---
model_optimization_flavor(optimization_level=0, compression_level=0)
normalization1 = normalization([0.0,0.0,0.0],[255.0,255.0,255.0])
nms_postprocess("/content/probe/nms_config.json", meta_arch=yolov8, engine=cpu)

[info] The activation function of layer probe/conv54 was replaced by a Sigmoid
[info] The activation function of layer probe/conv65 was replaced by a Sigmoid
[info] The activation function of layer probe/conv80 was replaced by a Sigmoid
```

The sequence is decisive: after parsing, the classification convs carry **no** activation; after `nms_postprocess(meta_arch=yolov8)` is applied, DFC replaces the activation on **all three** cls convs — one per stride — of its own accord. Nothing in our ALLS asks for it.

### The artifact, obtained after the fact

The three log lines above are DFC narrating itself. The decisive evidence is inside the saved HAR, in `probe.modifications_meta_data.json`:

```json
"outputs": { "probe/postprocess_output_layer": [{
  "cmd_type": "nms_postprocess", "meta_arch": "yolov8", "engine": "cpu",
  "hn_output_layers": ["probe/conv51","probe/conv54","probe/conv62",
                       "probe/conv65","probe/conv77","probe/conv80"],
  "sigmoid_layers":   ["probe/conv54","probe/conv65","probe/conv80"]
}]}
```

Those three are exactly the `cls_layer` of each stride's bbox decoder, per `probe.nms.json` in the same archive. **DFC records the sigmoid as part of the `nms_postprocess` modification** — it never emits a `change_output_activation` line, which is why the effective `probe.alls` contains only what we supplied.

*Open, and not resolved here:* Hailo's own `yolov11s.alls` does carry explicit `change_output_activation` lines. If `nms_postprocess` already applies them, why theirs does too is unexplained — possibly a different flow, possibly redundancy. Not needed for this decision, but not understood either.

### How this was verified, and how it was almost got wrong

The first reading was published from the log lines alone, before any artifact was opened — the claim-before-verify shape this repo keeps recording. The answer happened to survive, but the confidence at the time was not earned.

Worse, the probe's own verdict then said the **opposite**: `NO output layer carries a sigmoid after optimize`. That was a bug in the check, not a contradiction in the evidence — `nms_postprocess` collapses the six head outputs into one NMS output, so the cls convs stop being output layers and their `activation` field stays `None` whether or not the sigmoid was applied. Reading that field was the wrong test. The script now reads `sigmoid_layers` from the HAR's modification record and cross-checks it against the decoders' `cls_layer` list, which is the thing that actually carries the answer.

**What this rules out.** Every HEF this repo has produced has been feeding *probabilities*, not raw logits, into `nms_scores_th`. That was the worst available explanation for the INT8 collapse — it would have implicated every artifact ever built here — and it is now eliminated by direct observation rather than by argument.

**Where that leaves the collapse.** Back on `optimization_level`, which [02](./02-hailo-compile-params.md) ranked first: level 2 is quantization-aware fine-tuning, it wants a GPU, and a diverging QFT matches the 2026-07-21 dead-HEF incident exactly. The contract already defaults `optimization_level` to 0 and refuses level 2 with fewer than 1024 calibration images, so the decisions taken before this evidence arrived hold up.

### A second finding, unplanned

The first attempt used **synthetic** calibration frames and DFC refused to quantize:

```
NegativeSlopeExponentNonFixable: Quantization failed in layer probe/conv80 due to unsupported
required slope. Desired shift is 8.0, but op has only 8 data bits. ... Mostly happens when using
random calibration-set/weights, the calibration-set is not normalized properly ...
```

Re-running with 16 **real** frames cleared it. That is direct evidence for something the contract had only asserted: the calibration set is not a formality, and a poor one can fail the compile outright rather than merely degrade it. It strengthens [08](./08-compile-notebook-and-recompile-flow.md)'s decision to make calibration sets named, hashed artifacts rather than whatever directory happened to be at hand.
