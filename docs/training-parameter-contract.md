# The training parameter contract

The decisions behind the New-run form and the run config, consolidated from the
wayfinder map at `.scratch/train-param-contract/`. Each section links the ticket
that holds the reasoning; this file is the summary, not the record.

## Why it exists

Two incidents on 2026-09-02, one root cause.

**The Muon crash.** No `optimizer` key existed in the form, the config, or
`DEFAULT_TRAIN_KWARGS`, so ultralytics' `optimizer="auto"` selected an experimental
optimizer that crashed at epoch 1. A default nobody could see cost a Colab session.

**The INT8 collapse.** A model at 0.85–0.97 FP32 confidence produced a HEF that did
not detect, compiled at `optimization_level: 2` against calibration images sampled
from its own training split. Nothing measured INT8 quality before publication.

Both are the same disease: **the parameter surface was not a contract.** Defaults
lived in two unlinked copies, the UI exposed a subset of what the pipeline read, and
no layer validated the config's contents.

## The bar

1. **Fail fast** — an invalid config is rejected before Colab burns GPU time.
2. **No silent default** — no value that affects the outcome is invisible to the
   person launching the run.
3. **What-you-set-is-what-ran** — a finished run's real values can be read back.

## Four categories

Every parameter is exactly one of these. "Complete" does not mean "everything
editable" — opening some values *is* the failure mode. → [issue 06]

| Category | Behaviour | Examples |
|---|---|---|
| **field** | Editable, validated, with a default and help text | `epochs`, `optimizer`, `calib_n` |
| **advanced** | JSON escape hatch, checked against ultralytics' real argument list | `weight_decay`, `hsv_*` |
| **derived** | Shown, never editable — a fact, not a choice | `classes`, `regression_length`, `input_shape` |
| **refused** | Rejected at submit | `single_cls` |

`imgsz` stays editable — training at 512 or 720 is a legitimate experiment — and the
coupling is a rule *between runs*: a compile inherits its source run's input size, and
a mismatch is refused.

## Where the schema lives

**One JSON file**, `apps/web/src/lib/paramSchema.json`, read directly by the browser,
the `start-training` edge function and the Python pipeline. No codegen: TS and Python
both read JSON natively, and every generation step is a step someone forgets to run.
→ [issue 05]

Each parameter carries `default`, accepted range or `enum`, its **category**, its
**help** text (what it does *and* what it affects), which `form` it belongs to, and
what it applies to. Category and help belong in the schema rather than the markup
because the same explanation must be true in the form, in the pre-launch preview and
in the run's record.

**A conformance test keeps it honest:** every train key must exist in ultralytics'
`DEFAULT_CFG_DICT`, and every default we claim must match the pinned version's.

## Who refuses a bad config

Two kinds of validation, two homes. → [issue 04]

- **Static** — does the key exist, is the value in range, do cross-field rules hold.
  Owned by the **`start-training` edge function**, the choke point every run passes
  through and therefore the only place that can guarantee nothing invalid reaches the
  database. The browser mirrors it for instant feedback; it is a convenience, not the gate.
- **Environment** — does the *installed* ultralytics accept this, does the checkpoint
  download, is there a GPU for `optimization_level=2`. Only Python at run start can
  answer these. A failure records what it found so the **next** run's preflight warns first.

The edge function also **resolves** the effective config, because resolved values are
what gets stored. Defaults come in two layers: ours resolve server-side and can be shown
truthfully before launch; ultralytics' hundred-odd others are knowable only inside the run.

**A run is valid from birth.** Drafts hold anything; runs do not exist in an invalid state.

## What gets recorded

Three layers, not one. → [issue 07]

1. **Requested** — what was submitted.
2. **Effective (ours)** — after our defaults resolve. Both written by the edge function.
3. **Effective (final)** — after ultralytics fills the rest, written by the run itself.
   Only this layer can name values nobody chose, which is the class the Muon crash belonged to.

A queryable summary lives on the run row; the full record is a JSON artifact beside
`.pt` and `.onnx`, so it travels with the model. `hef.meta.yaml` keeps its own copy and
gains `run_id` + `source_run_id`, so a HEF sitting on a Pi can be traced home.

## Compile is a run

Not a button. It has parameters, duration, failure modes and artifacts. A compile run
carries `source_run_id`; "train then compile" creates the second run when the first
succeeds. Both kinds share **one launcher notebook** that dispatches on kind — which
dissolves the stale `compile_run.ipynb` copy. Configuration comes from the registry;
an override path exists but cannot publish artifacts. Calibration sets are **named R2
artifacts referenced by key**, never disk paths, because two compiles are only
comparable if they provably used the same images. → [issue 08]

## The model catalogue

Verified against the official docs. YOLO11 publishes five tasks; YOLO26 seven, adding
semantic segmentation and depth. Only detection has published performance tables, so
everything else reads "no published table" rather than inventing numbers. → [issue 03]

Capability is **per path**, not a boolean, and known-broken paths **block** rather than
warn:

- `yolo11` detect → on-chip NMS. Supported.
- `yolo11` segment → raw path, host-side mask decode. Warned.
- `yolo26` (any task) → **blocked.** YOLO26 removes Distribution Focal Loss and defaults
  to an NMS-free one-to-one head, so its box branch is 4 channels; the on-chip
  `meta_arch=yolov8` decoder needs a 64-channel DFL box. Training, export and compile all
  report success and the device counts zero.
- pose / obb → **blocked.** They compile with the extra branch silently dropped.

Known and unbuilt: the `/model.23/` head prefix is hardcoded, which is why only five of
46 trainable checkpoints compile today — the index is 22 on YOLOv8, 42 on YOLOv9e, 21 on
YOLO12, and deriving it is a small fix that would make the capability labels true.

## Toolchain

`ultralytics==8.4.138` pinned in `pyproject.toml`; the notebook installs from the repo
rather than resolving afresh. The Muon crash existed in exactly one upstream release —
what let it in was an unpinned `%pip install`. On a version mismatch the run refuses
before training. → [issue 10]

## Still open

- **The cls sigmoid.** Hailo's own `yolov11s.alls` carries
  `change_output_activation(<cls_conv>, sigmoid)`; ours emits none, and the runtime
  applies no sigmoid of its own. Whether DFC inserts it automatically is unverified and
  needs one Colab check — if it does not, every HEF this repo has produced has been
  feeding raw logits to a probability threshold. → [issue 11]
- **A YOLO26 compile path**, needing a cross-repo decoder contract — though the docs
  describe a one-to-many head that may carry the classical DFL box and make it far cheaper.
- **The INT8-vs-FP32 gate** itself. This contract only requires that a measurement exists
  and travels with the HEF.

[issue 03]: ../.scratch/train-param-contract/issues/03-model-catalogue.md
[issue 04]: ../.scratch/train-param-contract/issues/04-where-validation-lives.md
[issue 05]: ../.scratch/train-param-contract/issues/05-schema-source-of-truth.md
[issue 06]: ../.scratch/train-param-contract/issues/06-fields-vs-escape-hatch.md
[issue 07]: ../.scratch/train-param-contract/issues/07-provenance-effective-config.md
[issue 08]: ../.scratch/train-param-contract/issues/08-compile-notebook-and-recompile-flow.md
[issue 10]: ../.scratch/train-param-contract/issues/10-toolchain-pinning.md
[issue 11]: ../.scratch/train-param-contract/issues/11-verify-cls-sigmoid-in-alls.md
