# Ultralytics training arguments — research findings

**Research date:** 2026-09-03
**Researcher:** Loom Oracle (AI)

## Sources used

Every claim below is tagged with one of these:

- `[local]` — read from the ultralytics installed at
  `/Users/pitikorn/Work/BSCP/sack-train-ml/.venv/lib/python3.14/site-packages/ultralytics/`, **version 8.4.56**.
  Paths are written relative to that directory, e.g. `cfg/__init__.py:175`.
- `[8.4.138]` — read from the current PyPI release `v8.4.138` fetched from
  `https://raw.githubusercontent.com/ultralytics/ultralytics/v8.4.138/...`.
  This is what a fresh Colab `pip install ultralytics` gets **today** (PyPI `info.version` == `8.4.138`, checked 2026-09-03).
- `[docs]` — <https://docs.ultralytics.com/usage/cfg/> (tracks `main`).
- `[gh]` — GitHub REST API against `ultralytics/ultralytics` (commits, PRs, tags).
- `[repo]` — this repository, `/Users/pitikorn/Work/BSCP/sack-train-ml`.

The local venv (8.4.56) is **82 patch releases behind** the version Colab installs.
Where the two disagree the 8.4.138 answer is authoritative for the Colab pipeline, and the difference is called out.

---

## Summary — answer to Q2 (programmatic validation)

**Programmatic validation of custom training params is cheap — it is three imports and two function calls, no training run and no GPU required.**
`ultralytics.utils.DEFAULT_CFG_DICT` is the complete `{name: default}` map (115 keys in 8.4.138), loaded straight from `ultralytics/cfg/default.yaml`; `ultralytics.cfg.CFG_FLOAT_KEYS / CFG_FRACTION_KEYS / CFG_INT_KEYS / CFG_BOOL_KEYS` are four frozensets giving the declared type of each typed key; `ultralytics.cfg.check_dict_alignment(DEFAULT_CFG_DICT, user_dict)` raises `SyntaxError` (with a `difflib` "did you mean" suggestion) on any unknown key; and `ultralytics.cfg.check_cfg(user_dict, hard=True)` raises `TypeError` / `ValueError` on a wrong type or an out-of-`[0,1]` fraction.
Ultralytics itself **rejects** unknown kwargs passed to `model.train()` — it does not silently ignore them — because `Model.train()` funnels every kwarg into `get_cfg()`, which calls `check_dict_alignment` first (verified concretely, see Q2 below).
The catch that actually matters for this repo is the **other** direction: 29 of 115 keys — including `optimizer`, `imgsz`, `device`, `amp`, `freeze`, `scale`, `pretrained`, `cache` — belong to **no** type group and get **no** value check at all, so a wrong *value* for a valid *key* (the Muon incident's exact shape) passes `get_cfg()` untouched and only blows up minutes later inside `BaseTrainer._setup_train`.
A UI-side validator therefore gets key-existence and typed-range checking for free from ultralytics, and must supply its own enum/range table for those 29 untyped keys.

---

## Q1 — The tunable argument surface of `model.train()`

`model.train(**kwargs)` accepts **any key present in `ultralytics/cfg/default.yaml`**, plus the two extra keys `augmentations` and `save_dir` `[8.4.138 cfg/__init__.py:646]`.
There is no separate "train args" allowlist: train/val/predict/export arguments all live in one flat namespace, and passing e.g. `format=onnx` to `train()` is accepted-and-ignored rather than rejected.
Defaults below are from `[8.4.138]` (what Colab installs); where 8.4.56 differs it is noted.

### (a) Core / run control

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `model` | str/None | `None` | Path to `.pt` weights or `.yaml` arch. Set by `Model()` in practice. |
| `data` | str/None | `None` | Dataset YAML path. |
| `task` | str | `detect` | `detect \| segment \| semantic \| depth \| classify \| pose \| obb`. |
| `mode` | str | `train` | Forced to `train` by `Model.train()` `[local engine/model.py:769]`. |
| `epochs` | int | `100` | Total training epochs. |
| `time` | float/None | `None` | Max training hours; **overrides `epochs`** when set. |
| `patience` | int | `100` | Early-stop after N epochs without val improvement. |
| `batch` | int/float | `16` | Int = fixed batch; `-1` = AutoBatch (~60% VRAM); float in (0,1] = fraction of GPU memory. |
| `imgsz` | int/list | `640` | Train/val use a single int (square). |
| `device` | int/str/list/None | `None` | `0`, `[0,1]`, `cpu`, `mps`, `npu:0`, `xpu:0`, or `-1` to auto-pick idle GPUs. |
| `workers` | int | `8` | Dataloader workers (per RANK under DDP). |
| `seed` | int | `0` | RNG seed; applied as `seed + 1 + RANK` `[local engine/trainer.py:134]`. |
| `deterministic` | bool | `True` | Force deterministic kernels (slower). |
| `resume` | bool/str | `False` | Resume from `last.pt` in the run dir, or a checkpoint path. |
| `project` | str/None | `None` | Results root dir. |
| `name` | str/None | `None` | Run dir name under `project`. |
| `exist_ok` | bool | `False` | Allow overwriting an existing `project/name`. |
| `save_dir` | str/None | — | Not in `default.yaml`; explicitly whitelisted as a custom key `[8.4.138 cfg/__init__.py:646]`. |
| `pretrained` | bool/str | `True` | Use pretrained weights, or load from a path. |
| `single_cls` | bool | `False` | Collapse **all** classes into one. |
| `classes` | int/list/None | `None` | Restrict training to these class ids. |
| `rect` | bool | `False` | Rectangular (min-padding) batches instead of square letterbox. |
| `cache` | bool/str | `False` | `True`/`'ram'` or `'disk'` image caching. |
| `amp` | bool/str | `True` | `True`/`'fp16'` (runs an AMP capability check), `'bf16'`, or `False`/`'fp32'`. |
| `freeze` | int/list/None | `None` | Freeze first N layers, or named/indexed modules (e.g. `"23.cv2"`). |
| `profile` | bool | `False` | Profile ONNX/TensorRT speeds during training. |
| `compile` | bool/str | `False` | `torch.compile()`: `True`="default", or `"reduce-overhead"` / `"max-autotune-no-cudagraphs"`. |
| `channels_last` | bool/None | `None` | **NEW in 8.4.137** — auto-enables channels-last memory format for CUDA training. Absent in 8.4.56. **This is the argument that caused the incident (see Q3).** |
| `cls_remap` | bool | `True` | **NEW since 8.4.56** — when fine-tuning across datasets, remap pretrained cls-head rows by class-name match. |
| `verbose` | bool | `True` | Verbose logging. |
| `cfg` | str/None | `None` | Path to a YAML whose contents become the base config. |

### (b) Optimizer & schedule

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `optimizer` | str | `auto` | `SGD \| MuSGD \| Adam \| Adamax \| AdamW \| NAdam \| RAdam \| RMSprop \| auto`. See Q3. |
| `lr0` | float [0,1] | `0.01` | Initial LR (SGD≈1e-2, Adam/AdamW≈1e-3). **Ignored when `optimizer=auto`.** |
| `lrf` | float [0,1] | `0.01` | Final LR fraction; final LR = `lr0 * lrf`. |
| `momentum` | float [0,1] | `0.937` | SGD momentum, or Adam `beta1`. **Ignored when `optimizer=auto`.** |
| `weight_decay` | float [0,1] | `0.0005` | L2 regularization. Scaled by `batch*accumulate/nbs` before use `[8.4.138 engine/trainer.py:303]`. |
| `warmup_epochs` | float | `3.0` | Warmup length in epochs (fractions allowed). |
| `warmup_momentum` | float [0,1] | `0.8` | Momentum at start of warmup. |
| `warmup_bias_lr` | float [0,1] | `0.1` | Bias LR during warmup. **Force-set to `0.0` when `optimizer=auto`** `[8.4.138 engine/trainer.py:1117]`. |
| `cos_lr` | bool | `False` | Cosine LR schedule instead of linear. |
| `nbs` | int | `64` | Nominal batch size for loss normalization / gradient accumulation. |
| `close_mosaic` | int | `10` | Disable mosaic for the final N epochs (0 = never disable). |
| `multi_scale` | float [0,1] | `0.0` | Random per-batch resize range as a fraction of `imgsz`. |

### (c) Loss weights

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `box` | float | `7.5` | Box regression loss gain. |
| `cls` | float | `0.5` | Classification loss gain. |
| `cls_pw` | float [0,1] | `0.0` | Class-weight power for imbalance (0 = off, 1 = full inverse frequency). **Moved from `CFG_FLOAT_KEYS` to `CFG_FRACTION_KEYS` between 8.4.56 and 8.4.138** — i.e. values >1.0 that used to be accepted now raise `ValueError`. |
| `dfl` | float | `1.5` | Distribution-focal / box-distance loss gain. |
| `pose` / `kobj` / `rle` | float | `12.0` / `1.0` / `1.0` | Pose-task loss gains (irrelevant for detect). |
| `angle` | float | `1.0` | OBB angle loss gain (irrelevant for detect). |
| `dlog` / `dgrad` / `dlam` | float | `1.0` / `0.5` / `1.0` | Depth-task loss gains — **new since 8.4.56**, irrelevant for detect. |
| `distill_model` | str/None | `None` | **New since 8.4.56** — teacher model path for knowledge distillation. |
| `dis` | float | `6.0` | **New since 8.4.56** — distillation loss weight (only active with `distill_model`). |

### (d) Augmentation

| Arg | Type | Default | Applies to detect? | Meaning |
|---|---|---|---|---|
| `hsv_h` | float [0,1] | `0.015` | yes | Hue jitter fraction. |
| `hsv_s` | float [0,1] | `0.7` | yes | Saturation jitter fraction. |
| `hsv_v` | float [0,1] | `0.4` | yes | Brightness/value jitter fraction. |
| `degrees` | float | `0.0` | yes | ± rotation degrees. |
| `translate` | float [0,1] | `0.1` | yes | ± translation fraction. |
| `scale` | float/tuple | `0.5` | yes | ± scale gain, or explicit `(min, max)`. **Not in any type group** — but `check_cfg` has a bespoke branch for it `[local cfg/__init__.py:388-406]`. |
| `shear` | float | `0.0` | yes | ± shear degrees. |
| `perspective` | float [0,1] | `0.0` | yes | Perspective fraction (0–0.001 typical). |
| `flipud` | float [0,1] | `0.0` | yes | Vertical-flip probability. |
| `fliplr` | float [0,1] | `0.5` | yes | Horizontal-flip probability. |
| `bgr` | float [0,1] | `0.0` | yes | RGB↔BGR channel-swap probability. |
| `mosaic` | float [0,1] | `1.0` | yes | 4-image mosaic probability. |
| `mixup` | float [0,1] | `0.0` | yes | MixUp probability. |
| `cutmix` | float [0,1] | `0.0` | yes | CutMix probability. |
| `copy_paste` | float [0,1] | `0.0` | **segment/obb only** | Copy-paste fraction. |
| `copy_paste_mode` | str | `flip` | segment/obb | `flip` or `mixup`. |
| `auto_augment` | str | `randaugment` | **classify only** | `randaugment \| autoaugment \| augmix`. |
| `erasing` | float [0,1] | `0.4` | **classify only** | Random-erasing probability. Moved into `CFG_FRACTION_KEYS` since 8.4.56. |
| `augmentations` | list | — | yes | Custom Albumentations transforms; not in `default.yaml`, whitelisted as a custom key `[8.4.138 cfg/__init__.py:646]`. Cannot be expressed in a JSON run-config — it is a list of Python callables. |

### (e) Validation / saving

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `val` | bool | `True` | Run validation each epoch. |
| `split` | str | `val` | Which split to validate on: `val \| test \| train`. |
| `save` | bool | `True` | Save checkpoints. |
| `save_period` | int | `-1` | Save a checkpoint every N epochs (<1 disables). |
| `plots` | bool | `True` | Write training/val plots and sample images. |
| `fraction` | float/int/list | `1.0` | Fraction (or, since 8.4.130, integer count) of the train set to use. |
| `save_json` | bool | `False` | Write COCO-format JSON results. |
| `conf` | float/None | `None` | Confidence threshold (val defaults to 0.001). |
| `iou` | float [0,1] | `0.7` | NMS IoU threshold at val time. |
| `max_det` | int | `300` | Max detections per image at val time. |
| `visualize` | bool | `False` | Visualize TP/FP/FN confusion at val. |
| `dnn` | bool | `False` | Use OpenCV DNN for ONNX inference. |
| `end2end` | bool/None | `None` | Use end2end head (YOLO26/YOLOv10). |

### (f) Everything else accepted-but-irrelevant to training

Segmentation (`overlap_mask`, `mask_ratio`), classification (`dropout`), predict settings (`source`, `vid_stride`, `stream_buffer`, `augment`, `agnostic_nms`, `retina_masks`, `embed`), visualization (`show*`, `save_txt`, `save_conf`, `save_crop`, `save_frames`, `line_width`), export settings (`format`, `keras`, `optimize`, `dynamic`, `simplify`, `opset`, `workspace`, `nms`, `quantize`), and `tracker`.
All of these are valid keys in the shared namespace, so `model.train(format="onnx")` will **not** error — it is simply inert.
This is worth knowing for a UI: "accepted" does not mean "has an effect during training".

**Export-arg breaking change since 8.4.56:** `half` and `int8` were **removed** from `default.yaml` and replaced by a unified `quantize` key `[8.4.138 cfg/default.yaml]`.
They are still accepted via a deprecation shim that maps them onto `quantize` with a warning `[8.4.138 cfg/__init__.py:587-596]`, so they are not yet hard errors — but they are on the removal path.
`[repo]` does not pass `half`/`int8` to ultralytics (its `int8` references are all Hailo-DFC-side, `src/sack_train_ml/hailo_pipeline.py:303`, `src/sack_train_ml/evaluation.py`), so this is not currently a live break.

---

## Q2 — Programmatic enumeration and validation (the design-decision question)

### The API surface

| Symbol | Import path | What it gives you |
|---|---|---|
| `DEFAULT_CFG_DICT` | `from ultralytics.utils import DEFAULT_CFG_DICT` | `dict` of every valid key → its default. Loaded from `cfg/default.yaml` `[local utils/__init__.py:669]`. |
| `DEFAULT_CFG_KEYS` | `from ultralytics.utils import DEFAULT_CFG_KEYS` | `DEFAULT_CFG_DICT.keys()` `[local utils/__init__.py:670]`. |
| `DEFAULT_CFG` | `from ultralytics.utils import DEFAULT_CFG` | Same data as an `IterableSimpleNamespace` `[local utils/__init__.py:671]`. |
| `DEFAULT_CFG_PATH` | `from ultralytics.utils import DEFAULT_CFG_PATH` | Path to `cfg/default.yaml` — the inline comments there are the best one-line descriptions available. |
| `CFG_FLOAT_KEYS` | `from ultralytics.cfg import CFG_FLOAT_KEYS` | frozenset, int-or-float `[local cfg/__init__.py:175]`. |
| `CFG_FRACTION_KEYS` | `from ultralytics.cfg import CFG_FRACTION_KEYS` | frozenset, float constrained to `[0.0, 1.0]` `[local cfg/__init__.py:189]`. |
| `CFG_INT_KEYS` | `from ultralytics.cfg import CFG_INT_KEYS` | frozenset, int only `[local cfg/__init__.py:216]`. |
| `CFG_BOOL_KEYS` | `from ultralytics.cfg import CFG_BOOL_KEYS` | frozenset, bool only `[local cfg/__init__.py:231]`. |
| `check_dict_alignment` | `from ultralytics.cfg import check_dict_alignment` | Raises `SyntaxError` listing every unknown key with `difflib` suggestions `[local cfg/__init__.py:511]`. |
| `check_cfg` | `from ultralytics.cfg import check_cfg` | `hard=True` raises `TypeError`/`ValueError`; `hard=False` coerces in place `[local cfg/__init__.py:351]`. |
| `get_cfg` | `from ultralytics.cfg import get_cfg` | Does both of the above then returns the merged namespace `[local cfg/__init__.py:304]`. |

### Runnable snippet (verified against the local 8.4.56 install)

```python
from ultralytics.utils import DEFAULT_CFG_DICT, DEFAULT_CFG_KEYS
from ultralytics.cfg import (
    CFG_FLOAT_KEYS, CFG_FRACTION_KEYS, CFG_INT_KEYS, CFG_BOOL_KEYS,
    check_dict_alignment, check_cfg,
)

def kind(k: str) -> str:
    if k in CFG_BOOL_KEYS:     return "bool"
    if k in CFG_INT_KEYS:      return "int"
    if k in CFG_FRACTION_KEYS: return "float[0,1]"
    if k in CFG_FLOAT_KEYS:    return "float"
    return "str/other (UNCHECKED)"

# 1. Enumerate the whole contract: name, default, declared type.
for k in sorted(DEFAULT_CFG_KEYS):
    print(f"{k:20s} default={DEFAULT_CFG_DICT[k]!r:24s} type={kind(k)}")

# 2. Validate a user-supplied override dict without touching a GPU.
def validate(user: dict) -> list[str]:
    errs = []
    try:
        check_dict_alignment(DEFAULT_CFG_DICT, dict(user))   # unknown keys
    except SyntaxError as e:
        errs.append(str(e).split("\n")[0])
    try:
        check_cfg(dict(user), hard=True)                     # types + [0,1] ranges
    except (TypeError, ValueError) as e:
        errs.append(str(e))
    return errs
```

Observed output of part 1 on the local install: `total keys: 109`, `epochs default=100 type=int`, `imgsz default=640 type=str/other (UNCHECKED)`, `optimizer default='auto' type=str/other (UNCHECKED)`, `lr0 default=0.01 type=float[0,1]`, `mosaic default=1.0 type=float[0,1]`, `batch default=16 type=float`.

### Does ultralytics reject unknown keys, or silently ignore them?

**It rejects them, hard.**
Verified concretely `[local]` by running the three cases below in the repo venv (no training started — `check_dict_alignment`/`get_cfg` are pure config functions):

| Input | Result |
|---|---|
| `check_dict_alignment(DEFAULT_CFG_DICT, {"epochs": 10, "bogus_key": 1})` | `SyntaxError: 'bogus_key' is not a valid YOLO argument.` |
| `get_cfg(overrides={"bogus_key": 1})` | `SyntaxError: 'bogus_key' is not a valid YOLO argument.` |
| `get_cfg(overrides={"epochs": 3.5})` | `TypeError: 'epochs=3.5' is of invalid type float. 'epochs' must be an int (i.e. 'epochs=8')` |
| `get_cfg(overrides={"mosaic": 2.0})` | `ValueError: 'mosaic=2.0' is an invalid value. Valid 'mosaic' values are between 0.0 and 1.0.` |

The call chain that makes this reach `model.train()`:
`Model.train(**kwargs)` builds `args = {**overrides, **custom, **kwargs, "mode": "train", "session": ...}` `[local engine/model.py:769]` → `self.trainer = trainer_cls(overrides=args, ...)` `[local engine/model.py:783]` → `BaseTrainer.__init__` pops `session` then calls `self.args = get_cfg(cfg, overrides)` `[local engine/trainer.py:125-126]` → `get_cfg` calls `check_dict_alignment(cfg, overrides)` then `check_cfg(cfg)` `[local cfg/__init__.py:331, 345]`.
So the rejection happens **before** any dataloader is built, i.e. within seconds of `train()` being called — cheap failure, not a 20-minute one.
The only escapes are the two whitelisted custom keys `augmentations` and `save_dir`, and the deprecation shim which silently rewrites `boxes`/`hide_labels`/`hide_conf`/`line_thickness` and silently *drops* `label_smoothing`/`save_hybrid`/`crop_fraction` with a warning `[local cfg/__init__.py:488-505]`.

### The gap that actually bit us

**29 of the 115 keys in 8.4.138 belong to no type group and receive no value check whatsoever:**

`task, mode, model, data, imgsz, cache, device, project, name, pretrained, optimizer, resume, amp, freeze, compile, split, quantize, source, stream_buffer, classes, embed, format, opset, distill_model, scale, copy_paste_mode, auto_augment, cfg, tracker`

(`scale` is the one partial exception — it has a hand-written branch in `check_cfg` `[local cfg/__init__.py:388-406]`.)

For these, `get_cfg()` accepts literally any value.
`optimizer="Adamw"` works (case-insensitive lookup), but `optimizer="adam2"` sails through config validation and only raises `NotImplementedError` inside `BaseTrainer.build_optimizer` `[8.4.138 engine/trainer.py:1142]`, which runs in `_setup_train` **after** the model is loaded and both dataloaders are constructed.
Likewise `imgsz="640"` (a string, e.g. straight out of a JSON form) passes config validation.

**Design implication:** a UI-side validator gets key-existence + typed-range checking for free by shelling `check_dict_alignment` + `check_cfg`.
It must hand-maintain an enum/range table for the ~10 of those 29 keys a user could plausibly set (`optimizer`, `imgsz`, `amp`, `pretrained`, `cache`, `device`, `freeze`, `compile`, `split`, `scale`).
That is a small, bounded table — the feature is cheap.

---

## Q3 — The `optimizer` argument

### Valid values

`{"Adam", "Adamax", "AdamW", "NAdam", "RAdam", "RMSprop", "SGD", "MuSGD", "auto"}` `[8.4.138 engine/trainer.py:1106]`.
Matching is case-insensitive `[8.4.138 engine/trainer.py:1107]`.

Note a spelling drift: 8.4.56 spells it `"RMSProp"` `[local engine/trainer.py:1037]`, 8.4.138 spells it `"RMSprop"`.
Because the lookup lowercases, both spellings work in both versions — but a UI dropdown that hardcodes one exact string is safe either way, and `docs/en/modes/train.md` `[docs]` lists `RMSProp`.

### What `"auto"` actually does

The rule lives in `BaseTrainer.build_optimizer` `[8.4.138 engine/trainer.py:1108-1117]`:

```python
if name == "auto":
    nc = self.data.get("nc", 10)                      # number of classes
    lr_fit = round(0.002 * 5 / (4 + nc), 6)
    name, lr, momentum = ("MuSGD", 0.01, 0.9) if iterations > 10000 else ("AdamW", lr_fit, 0.9)
    self.args.warmup_bias_lr = 0.0
```

where

```python
iterations = math.ceil(len(train_loader.dataset) / max(batch_size, nbs)) * epochs
```

`[8.4.138 engine/trainer.py:304]`, with `nbs = 64` by default — so for a typical `batch <= 64` run, `iterations ≈ ceil(N_images / 64) * epochs`.

Consequences worth writing into the spec:

- `optimizer="auto"` **discards** the user's `lr0` and `momentum` entirely and logs that it is doing so `[8.4.138 engine/trainer.py:1109-1113]`. `[repo]` currently sets `lr0: 0.001` in `DEFAULT_TRAIN_KWARGS` — with `optimizer="auto"` that value would have been silently thrown away. Pinning `optimizer: "AdamW"` also un-silenced `lr0`.
- `optimizer="auto"` **force-writes `warmup_bias_lr = 0.0`**, overriding whatever the user set.
- For this repo's shape: `epochs=100`, 2 classes. The MuSGD threshold `iterations > 10000` is crossed at roughly `N_images > 6400` (with `epochs=100`, `batch<=64`). Below that, `auto` selects AdamW and the Muon path is never entered — which is why some runs were fine and one was not.

### The Muon `.view()` bug — CONFIRMED, root-caused, and fixed upstream

This is the single sharpest finding of this research.

| Fact | Evidence |
|---|---|
| The crash is `RuntimeError: view size is not compatible with input tensor's size and stride ...` at `u.view(len(u), -1)` in `ultralytics/optim/muon.py` | `[gh]` PR body of <https://github.com/ultralytics/ultralytics/pull/26013> — quotes the identical error text |
| **Root cause:** PR #26007 "Auto-enable channels-last CUDA training" made `channels_last` the default on CUDA, so conv-weight grads (and thus Muon momentum buffers) stopped being contiguous, and `.view()` cannot reshape a non-contiguous tensor | `[gh]` PR #26013 body; `[gh]` PR #26007 merged `2026-08-31T17:09:11Z` |
| The bug was **latent** in `muon.py` before that — `optimizer=MuSGD channels_last=True` crashed the same way on earlier versions | `[gh]` PR #26013 body, verbatim |
| **Fix:** `u.view(...)` → `u.reshape(...)` | `[gh]` commit `957b039c`, merged `2026-09-01T19:32:17Z` |

**The version boundary — this is exact:**

| Version | Released | State |
|---|---|---|
| `8.4.136` | 2026-08-31 09:31 UTC | channels-last not yet auto — MuSGD safe by default |
| **`8.4.137`** | **2026-08-31 17:09 UTC** (commit `1b120e5e`, which *is* PR #26007) | **BROKEN — `optimizer=auto` → MuSGD crashes on CUDA with default settings** |
| `8.4.138` | 2026-09-01 23:00 UTC (commit `dad7bb45`; contains fix commit `957b039c`) | Fixed |

`[gh]` — versions resolved by reading `ultralytics/__init__.py::__version__` at each version-bump commit; in this repo's release process the version-bump commit *is* the release.

So the broken window is **ultralytics 8.4.137 only — a ~30-hour window on 2026-08-31/09-01**.
The production incident's Colab run therefore installed 8.4.137.
`[gh]` PyPI `info.version` today (2026-09-03) is **8.4.138**, i.e. a fresh `pip install ultralytics` right now already gets the fix.
A further Muon rework landed after 8.4.138 — `21bbd85c` "Bucket Muon matrices by column count and flatten updates in memory order" (#26035, 2026-09-02) — so the Muon code path is still actively churning.

The traceback line number is itself a version fingerprint: the local 8.4.56 spells the flatten as `update = update.view(len(update), -1)` at `[local optim/muon.py:93]`; the `u.view(len(u), -1)` spelling at line 99 came from the #25288 batched-Newton-Schulz rewrite (2026-07-19).

**Known/reported/fixed upstream:** yes to all three — reported and fixed by PR #26013, merged into `main`, shipped in 8.4.138.
I did **not** find a separate user-filed issue thread for this specific crash; the search hit `ultralytics/ultralytics#19485` has the same error text but predates MuSGD and is unrelated `[gh]` — UNVERIFIED that it is the same defect, and I do not believe it is.

### Related MuSGD churn (context for "how volatile is this")

`[gh]` commits touching the auto-optimizer path since MuSGD was introduced in `8.4.0` (2026-01-14, `f2d3aed6`, the YOLO26 release):

- `fbb0caf5` → released in **8.4.3**: changed `("SGD", 0.01) if iterations>10000 else ("MuSGD", lr_fit)` to `("MuSGD", ...)` unconditionally.
- `434034ce` → released in **8.4.8**: changed to the current `("MuSGD", 0.01) if iterations>10000 else ("AdamW", lr_fit)`.
- `#25052` (8.4.x, 2026-07-07) "Fix crashes on invalid `copy_paste_mode` and `optimizer` values".
- `#25376` (2026-07-23) "Fix `optimizer=RMSprop` silently building MuSGD".
- `#25383`, `#25417`, `#25447`, `#25532` (2026-07) — four more MuSGD grouping/naming fixes.
- `#23637`/`#23642`/`#23842` (2026-02–03) — `warmup_bias_lr` incorrectly forced to 0.0 for MuSGD under `auto`.

**Reading of the auto-rule history (matters for a spec):**

| Version range | `optimizer=auto` picks |
|---|---|
| ≤ 8.3.253 | `SGD` if `iterations > 10000` else `AdamW` — Muon does not exist |
| 8.4.0 – 8.4.2 | `SGD` if `iterations > 10000` else **`MuSGD`** ← small datasets got Muon |
| 8.4.3 – 8.4.7 | **`MuSGD` always** |
| 8.4.8 – present | **`MuSGD`** if `iterations > 10000` else `AdamW` |

The auto-heuristic has been rewritten three times in eight months.
That, more than the specific `.view()` bug, is the argument for pinning `optimizer` explicitly.

---

## Q4 — Version volatility and pinning

### What the repo pins today

| Location | Current pin | `[repo]` |
|---|---|---|
| `pyproject.toml` | `ultralytics>=8.3.0` — lower bound only, no upper bound | `pyproject.toml:12` |
| `notebooks/train_run.ipynb` | `%pip install --quiet ultralytics onnx onnxsim pyyaml numpy` — **completely unpinned** | cell 6 |

So a Colab run's ultralytics version is "whatever PyPI serves at that minute".
Between the local venv (8.4.56) and today's PyPI (8.4.138) there are 82 releases, and `main` gets a release roughly **daily** (8.4.124 on 2026-08-20 → 8.4.138 on 2026-09-01 = 14 releases in 12 days) `[gh]`.

### Concrete drift from 8.4.56 → 8.4.138 (`default.yaml` diff)

**Added (8):** `channels_last`, `cls_remap`, `quantize`, `distill_model`, `dis`, `dlog`, `dgrad`, `dlam`
**Removed (2):** `half`, `int8` (folded into `quantize` behind a deprecation shim)
**Changed default (1):** `tracker: botsort.yaml` → `tracktrack.yaml`

**Type-group drift (silent behaviour change, no `default.yaml` diff):**

- `cls_pw` moved `CFG_FLOAT_KEYS` → `CFG_FRACTION_KEYS`. A config with `cls_pw: 2.0` that trained fine on 8.4.56 now raises `ValueError: 'cls_pw=2.0' is an invalid value. Valid 'cls_pw' values are between 0.0 and 1.0.`
- `erasing` gained a `[0,1]` range check it did not have before.
- `angle`, `pose`, `kobj`, `rle` gained float type checks.
- `half`/`int8` left `CFG_BOOL_KEYS`; `channels_last`/`cls_remap` joined it.

**No train-argument *default value* changed** between 8.4.56 and 8.4.138 apart from `tracker` (irrelevant to training).
The dangerous drift was not a changed default — it was a **new** argument (`channels_last`) whose new default behaviour changed a *different* argument's (`optimizer=auto`) runtime outcome.
That is the exact failure mode the spec should be written against: an argument nobody in this repo has ever heard of appeared and broke a run.

### Recommended pinning

1. **Pin an exact version in the notebook**, not a range: `%pip install --quiet "ultralytics==8.4.138" onnx onnxsim pyyaml numpy`. An exact pin is the only thing that makes a Colab run reproducible, and it makes upgrades a deliberate, reviewable commit.
2. **Record the resolved version in the run record.** `ultralytics.__version__` should be captured into the run's metadata/manifest alongside `BSCP_GIT_SHA` (which the notebook already captures, cell 7). Without it, a past run's behaviour is not reconstructible — the `optimizer=auto` outcome literally depends on which of four historical heuristics was installed.
3. **Tighten `pyproject.toml`** to a compatible range, e.g. `ultralytics>=8.4.138,<8.5`, so the local venv and Colab cannot drift 82 releases apart again.
4. Keep `optimizer` explicitly pinned in `DEFAULT_TRAIN_KWARGS` regardless — the version pin protects a single release, the explicit optimizer protects against the heuristic itself.

---

## Q5 — Relevance filter for this use case

Use case: 2-class (person, sack) detect fine-tune, `imgsz=640`, from pretrained `yolo11s.pt`, smallish dataset, destined for INT8 PTQ to a Hailo-8L via `scripts/compile_clientrunner.py` (**uint8 640 letterbox input, on-chip `/255`, on-chip NMS, 2 classes** — `[repo] scripts/compile_clientrunner.py:4-5`).

### Tier 1 — first-class fields in the UI form

| Arg | Why | Suggested control |
|---|---|---|
| `epochs` | The primary lever on cost and fit. | int, 1–500 |
| `batch` | Colab VRAM-bound; `-1`/`"auto"` already handled by `[repo] src/sack_train_ml/training.py::_coerce_batch`. | select `auto` / int |
| `imgsz` | **Coupled to deployment.** The HEF is compiled at a fixed 640 uint8 input `[repo] scripts/compile_clientrunner.py:5`, and `hailo_pipeline.py:276` hardcodes `"input_shape": [input_size, input_size, 3]`. Training at a different `imgsz` than the compiled HEF silently degrades the deployed model. | select {640} (locked), or int multiple of 32 with a loud warning |
| `optimizer` | The incident. Must be an explicit enum, never free text, never `auto`. | select `AdamW` (default) / `SGD` / `Adam` / `NAdam` / `RAdam` / `RMSprop` / `MuSGD` / `auto` — with `auto` and `MuSGD` marked "not recommended" |
| `lr0` | Meaningful only once `optimizer != auto`. Fine-tune from a pretrained checkpoint wants ~1e-3 for AdamW (`[repo]` already sets this). | float 1e-5 – 1e-1 |
| `patience` | `[repo]` overrides 100 → 20; on a small dataset this is what actually ends the run. | int |
| `close_mosaic` | On a small dataset the last-N-epochs mosaic-off phase is what makes val metrics reflect deployment-shaped images. | int, default 10 |
| `mosaic` | The one augmentation worth exposing — see the caution below. | float [0,1] |
| `fraction` | A deliberate "quick smoke run on 10% of data" switch. Also the highest-risk silent footgun if left set by accident. | float [0,1], default 1.0, shown prominently when ≠ 1.0 |
| `seed` | Required by the repo's own experiment discipline (log dataset version, config, **seed**, split, metrics — `CLAUDE.md`). | int, default 0 |
| `freeze` | The natural small-dataset lever (freeze the backbone). Currently unexposed. | int / null |

### Tier 2 — safe at defaults, expose behind "advanced"

`lrf`, `momentum`, `weight_decay`, `warmup_epochs`, `warmup_momentum`, `warmup_bias_lr`, `cos_lr`, `box`, `cls`, `dfl`, `nbs`, `hsv_*`, `degrees`, `translate`, `scale`, `shear`, `perspective`, `fliplr`, `bgr`, `mixup`, `cutmix`, `multi_scale`, `workers`, `cache`, `deterministic`, `val`, `split`, `plots`, `save_period`, `amp`, `compile`, `channels_last`, `cls_pw`.

These have sane defaults for a COCO-pretrained detect fine-tune and no known coupling to the deployment path.

### Tier 3 — never expose (inert or task-mismatched for detect)

`copy_paste`, `copy_paste_mode` (segment/obb only), `auto_augment`, `erasing`, `dropout` (classify only), `pose`, `kobj`, `rle`, `angle`, `dlog`, `dgrad`, `dlam` (other tasks), `overlap_mask`, `mask_ratio` (segment), every predict/visualize/export key, `tracker`, `augmentations` (Python callables — not JSON-expressible).

### Arguments that are actively dangerous for this pipeline

Ranked by how quietly they do damage.

1. **`optimizer: "auto"` — CONFIRMED, this is the incident.**
   Selects MuSGD once `iterations > 10000` (≈ >6400 images at 100 epochs), discards the user's `lr0` and `momentum`, and force-writes `warmup_bias_lr = 0.0`.
   The heuristic itself has been rewritten three times in eight months.
   **Keep the `AdamW` pin; do not offer `auto` as a default in the UI.** `[8.4.138 engine/trainer.py:1108-1117]`

2. **`single_cls: True` — CONFIRMED breaking.**
   Collapses person+sack into one class `[8.4.138 cfg/default.yaml:31]`.
   The whole downstream contract is 2 classes: the labelmap, `scripts/compile_clientrunner.py`'s on-chip NMS config, and the edge runtime.
   A run with `single_cls: True` would train, export, compile, and deploy — and be wrong. **Should be rejected at submit time, not exposed.**

3. **`imgsz ≠ 640` — CONFIRMED coupling.**
   The HEF input shape is fixed at compile time `[repo] scripts/compile_clientrunner.py:5, src/sack_train_ml/hailo_pipeline.py:276`.
   `[repo] src/sack_train_ml/training.py:67-69` already derives `imgsz` from `config.input_size` when it is square, which is the right instinct — but nothing rejects a non-square or non-640 `input_size`.
   Note also that `imgsz` is one of the 29 **type-unchecked** keys, so `imgsz: "640"` (a JSON string) passes `get_cfg` unexamined.

4. **`rect: True` — dangerous for this deployment.**
   Rectangular min-padding batches instead of square letterbox `[8.4.138 cfg/default.yaml:31]`.
   The edge feeds a **640 letterbox** frame `[repo] scripts/compile_clientrunner.py:5`, so training on min-padded rectangles trains on a preprocessing distribution the device never produces.
   *(Confidence: the `rect` semantics are verified from source; the claim that this measurably hurts deployed mAP is engineering judgment, UNVERIFIED by measurement here.)*

5. **`fraction < 1.0` — silent under-training.**
   Trains on a subset with no obvious signal in the final metrics. A run config carrying a leftover `fraction: 0.1` produces a plausible-looking but under-trained model.
   Should be surfaced loudly in the run record whenever ≠ 1.0.

6. **`resume: True` with a mismatched checkpoint.**
   `[8.4.138 engine/trainer.py:879]` re-loads `self.args = get_cfg(ckpt_args)` from the checkpoint, **discarding the run's own hyperparameters**. A resumed run silently ignores the config the UI submitted.

7. **`multi_scale > 0` — questionable for a fixed-shape NPU target.**
   Randomizes the training resolution `[8.4.138 cfg/default.yaml:40]`. The deployed HEF only ever sees 640×640.
   Trading fixed-resolution accuracy for scale robustness that the device cannot use is a bad trade here.
   *(Confidence: mechanism verified from source; the accuracy trade-off is judgment, UNVERIFIED.)*

8. **`amp` / `channels_last` — NOT dangerous for INT8, but worth stating so nobody "fixes" them.**
   `amp` is mixed-precision *training* (master weights stay FP32) and `channels_last` is a memory-layout choice; neither changes the exported FP32 ONNX weights, and Hailo's INT8 quantization is a separate post-training calibration step `[repo] scripts/compile_clientrunner.py:222-225`.
   The one caveat is the historical one: `channels_last` defaulting on is what surfaced the Muon crash in 8.4.137.

9. **INT8-quantization-specific risks — honestly, mostly UNVERIFIED.**
   I found **no** ultralytics training argument documented as affecting post-training INT8 quantization error, and I did not measure any.
   The plausible mechanism (very low `weight_decay` → wider weight/activation dynamic range → larger INT8 rounding error) is standard quantization folklore, not something I verified for this model or this Hailo toolchain. **Marked UNVERIFIED — do not encode it as a rule in the spec without an ablation.**
   The measurable guard the repo already has is the right one: `src/sack_train_ml/evaluation.py` compares `fp32_map` vs `int8_map` and gates on the delta. That empirical gate is worth more than any a-priori argument rule.

### Concrete spec recommendations that fall out of this

- Make `optimizer` a **closed enum**, defaulting to `AdamW`. It is type-unchecked by ultralytics, so the UI is the only place this can be caught cheaply.
- Add a **submit-time validator** using `check_dict_alignment` + `check_cfg` (cheap — see Q2) plus a small hand-written table for the 29 untyped keys.
- **Reject** `single_cls`, and reject `imgsz` that disagrees with `config.input_size`, at submit time.
- **Pin `ultralytics==8.4.138`** in `notebooks/train_run.ipynb` and record `ultralytics.__version__` in the run record.
- Render the **fully merged** `DEFAULT_TRAIN_KWARGS + hyperparameters` dict into the run record before `model.train()` is called, so "what was actually passed" is never again an inference from source-reading. The Muon incident cost 20–40 minutes precisely because the effective value of `optimizer` existed nowhere in the record.

---

## Explicitly UNVERIFIED

- That `rect: True` or `multi_scale > 0` measurably degrades deployed mAP for this model — mechanism verified, effect not measured.
- That any training argument systematically worsens INT8 PTQ error on the Hailo-8L — no source or measurement found; the `weight_decay` hypothesis is folklore.
- That `ultralytics/ultralytics#19485` relates to the MuSGD crash — it shares the error text but appears to be a different, older defect.
- Whether an end-user-filed issue (as opposed to the maintainer PR #26013) exists for the 8.4.137 MuSGD crash — I did not find one.
- Argument-by-argument default-value history before 8.4.56; I diffed 8.4.56 → 8.4.138 exactly, and traced only the `optimizer`/`auto` path further back.

---

*Loom Oracle (AI) — 2026-09-03*
