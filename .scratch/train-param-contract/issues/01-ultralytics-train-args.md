# 01 — What can ultralytics training actually tune, and can we validate it programmatically?

Type: research
Status: resolved
Blocked by: —

## Question

Enumerate the complete tunable argument surface of ultralytics `model.train()` — every argument, its default, type and meaning — and answer the decision-bearing question underneath it:

**Is there a programmatic way to enumerate valid argument names, types and defaults?** (`ultralytics/cfg/default.yaml`, `DEFAULT_CFG_DICT`, `CFG_FLOAT_KEYS`/`CFG_INT_KEYS`/`CFG_BOOL_KEYS`, `check_dict_alignment`, `get_cfg`.) If yes, a validated escape hatch for custom parameters is cheap and [06](./06-fields-vs-escape-hatch.md) can be generous. If no, every supported parameter must be hand-maintained and the escape hatch is a liability.

Also settle: what `optimizer="auto"` selects and in which versions it picks Muon (the crash that started this effort); whether ultralytics rejects or silently ignores unknown kwargs; how much argument defaults drift between versions, given Colab installs the latest; and which arguments materially matter for a 2-class 640px detection fine-tune destined for INT8.

Findings land in `../research/ultralytics-train-args.md`.

## Answer

**Programmatic validation is cheap — three imports and two calls, no GPU.** `ultralytics.utils.DEFAULT_CFG_DICT` gives all 115 argument names with defaults; `ultralytics.cfg.{CFG_FLOAT_KEYS, CFG_FRACTION_KEYS, CFG_INT_KEYS, CFG_BOOL_KEYS}` give declared types; `check_dict_alignment(DEFAULT_CFG_DICT, user)` raises `SyntaxError` on unknown keys *with difflib suggestions*; `check_cfg(user, hard=True)` raises on wrong type or out-of-range fraction. All four verified by running them in the repo venv. A validated escape hatch is therefore affordable, and [06](./06-fields-vs-escape-hatch.md) can be generous.

**Ultralytics already rejects unknown kwargs, hard and early** — `Model.train()` → `BaseTrainer.__init__` → `get_cfg()` → `check_dict_alignment`, before any dataloader is built. So a typo'd key fails fast even today; that was never the expensive failure.

**The expensive gap is values, not names.** 29 of the 115 keys sit in *no* type group and receive **zero** value checking — including `optimizer`, `imgsz`, `amp`, `device`, `freeze` and `pretrained`. `optimizer="adam2"` passes every config check and only dies inside `build_optimizer`, minutes into the session. Any validation we build must carry **its own enum table** for roughly ten of these; inheriting ultralytics' checking is not enough.

**The Muon window was one release wide.** Upstream PR #26007 auto-enabled `channels_last` on CUDA, making conv gradients non-contiguous so Muon's `u.view()` threw; PR #26013 fixed it. Broken in **8.4.137 only** (2026-08-31 17:09 UTC), fixed in **8.4.138** (2026-09-01 23:00 UTC, current PyPI latest). `optimizer="auto"` selects MuSGD when `iterations > 10000` (≈ >6400 images at 100 epochs), and that heuristic has been rewritten three times since 8.4.0.

**Consequence for this effort.** The `AdamW` pin in `367fe15` fixed a bug that upstream had already fixed a day earlier — the real exposure was never Muon, it was that **nothing pins the toolchain**: the notebook's `%pip install` is unpinned and `pyproject.toml:12` says `>=8.3.0`, so Colab grabbed a 5-hour-old broken release. The local venv meanwhile sits at 8.4.56, 82 releases behind. That is a distinct decision → raised as [10](./10-toolchain-pinning.md).

