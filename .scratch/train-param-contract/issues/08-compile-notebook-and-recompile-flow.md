# 08 — Separating compile from train: what happens to `compile_run.ipynb`?

Type: grilling
Status: open
Blocked by: —

## Question

Compiling a HEF today only happens as step 6b of `scripts/train_for_run.py`, *after* training finishes. When the INT8 collapse happened, recovering meant retraining 250 epochs to get another shot at the compile — even though the `.pt` and `.onnx` were fine. Comparing `opt_level: 0` against `opt_level: 2`, which the repo's own experiment discipline calls for (one changed lever per run), is currently priced at a full training run per arm.

Decided already: train and compile must be separable. This ticket decides the shape.

1. **What drives a standalone compile** — an existing `run_id` plus a fresh `compile_options` (which keeps provenance intact), or a free-standing form? Does a recompile create a new run row, a new version of the same run, or something else?
2. **The fate of `notebooks/compile_run.ipynb`.** It embeds a stale copy of the compile recipe via `%%writefile` and has drifted from the live `scripts/compile_clientrunner.py` — the live script gained ONNX head auto-detection and the raw-vs-on-chip NMS switch (`compile_clientrunner.py:55-106`) that the notebook copy never got. This drift already cost a wrong diagnosis: the notebook was believed to be the path that produced a broken HEF, and it was not. Delete it, or rebuild it as a thin launcher that clones the repo and calls the real script the way `train_run.ipynb` does?
3. **The rule about notebook-held config.** `train_run.ipynb` takes only `?run_id=` and pulls config from the registry; `compile_run.ipynb` has a hand-edited config cell. Adopt "configuration only ever arrives via `run_id` from the registry, never hand-edited in a notebook cell" as a standing rule? That preserves provenance but removes the quick local override.
4. **Where the calibration set comes from** for a standalone compile, now that `compile_options.calib_dir` exists (`dc3dbb2`) — and how a curated onsite calibration set is stored and referenced so a recompile is reproducible.
