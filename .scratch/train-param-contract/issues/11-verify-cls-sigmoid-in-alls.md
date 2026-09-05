# 11 — Does DFC auto-insert the cls sigmoid, or must our ALLS emit it?

Type: task
Status: open
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
