# 08 — Separating compile from train: what happens to `compile_run.ipynb`?

Type: grilling
Status: resolved
Blocked by: —

## Question

Compiling a HEF today only happens as step 6b of `scripts/train_for_run.py`, *after* training finishes. When the INT8 collapse happened, recovering meant retraining 250 epochs to get another shot at the compile — even though the `.pt` and `.onnx` were fine. Comparing `opt_level: 0` against `opt_level: 2`, which the repo's own experiment discipline calls for (one changed lever per run), is currently priced at a full training run per arm.

Decided already: train and compile must be separable. This ticket decides the shape.

1. **What drives a standalone compile** — an existing `run_id` plus a fresh `compile_options` (which keeps provenance intact), or a free-standing form? Does a recompile create a new run row, a new version of the same run, or something else?
2. **The fate of `notebooks/compile_run.ipynb`.** It embeds a stale copy of the compile recipe via `%%writefile` and has drifted from the live `scripts/compile_clientrunner.py` — the live script gained ONNX head auto-detection and the raw-vs-on-chip NMS switch (`compile_clientrunner.py:55-106`) that the notebook copy never got. This drift already cost a wrong diagnosis: the notebook was believed to be the path that produced a broken HEF, and it was not. Delete it, or rebuild it as a thin launcher that clones the repo and calls the real script the way `train_run.ipynb` does?
3. **The rule about notebook-held config.** `train_run.ipynb` takes only `?run_id=` and pulls config from the registry; `compile_run.ipynb` has a hand-edited config cell. Adopt "configuration only ever arrives via `run_id` from the registry, never hand-edited in a notebook cell" as a standing rule? That preserves provenance but removes the quick local override.
4. **Where the calibration set comes from** for a standalone compile, now that `compile_options.calib_dir` exists (`dc3dbb2`) — and how a curated onsite calibration set is stored and referenced so a recompile is reproducible.

## Answer

**A compile is a run, not a button.** It has every property that makes something a run: parameters (`compile_options`), duration, the ability to fail, and artifacts as output. Modelling it as an action on an existing run would leave it with no config record and no provenance — the exact disease this map exists to cure. So a compile is a run of its own kind, carrying a `source_run_id` pointing at the run whose `.onnx` it consumes.

Two consequences worth naming:

- The current one-click convenience survives unchanged in feel. "Train, then compile" becomes *a train run that declares a compile to follow*, which materialises a second run when the training succeeds — the person still clicks once, but the compile now has its own config and its own record.
- "Train once, compile three ways and compare" becomes expressible immediately, with no new machinery. That is the ablation the repo's own discipline asks for and currently cannot represent.

**One launcher notebook.** Since both kinds are "take a `run_id`, do what its config says", they share a launcher: `?run_id=` → clone the repo → read the run → dispatch on kind. `train_run.ipynb` already has this shape. `compile_run.ipynb` is not deleted by decision so much as dissolved — the stale `%%writefile` copy that caused a misdiagnosis has nowhere left to live, and only one path remains to maintain.

**Configuration comes from the registry; the notebook only launches.** Adopted as a rule, with one carve-out: an explicit override cell may exist for experimentation, but any run using it is marked non-reproducible from the start and **may not publish artifacts** — no `versions` row, no channel promotion.

*The limit of that rule, stated honestly:* the system can only enforce it for overrides that go through the declared mechanism. Someone editing the script itself is invisible to it. The carve-out exists precisely so that the tempting path is also the observable one — an absolute ban would push experimentation outside the system, which is how `compile_run.ipynb` became a shadow in the first place.

**Calibration sets become named artifacts, referenced by key.** Stored in R2 beside datasets and addressed by key, not by filesystem path. This corrects a flaw in the `calib_dir` override added earlier in `dc3dbb2`: a disk path is valid only inside the session that created it, so a recompile a week later silently calibrates against something else — and comparing `opt_level` 0 against 2 is meaningless if the two arms cannot be shown to have used identical images. A named, hashed calibration set also turns "use real onsite frames" from advice in a code comment into something the config can actually point at.

### The flow this produces

```
Train tab                                     Run / Version detail
┌────────────────────────────┐                ┌──────────────────────────┐
│ New training run           │                │  [ Compile again ]       │
│  dataset · classes         │                └───────────┬──────────────┘
│  weights · hyperparameters │                            │ opens the same
│  ☐ compile when done       │                            │ compile form,
└─────────────┬──────────────┘                            │ source prefilled
              │ creates                                   │
              ▼                                           ▼
     run(kind=train) ──── succeeds, if requested ──▶ run(kind=compile,
              │                                          source_run_id=…,
              │                                          compile_options,
              │                                          calib_key)
              │                                           │
              └───────────────┬───────────────────────────┘
                              ▼
                  one launcher: run.ipynb?run_id=…
                              │
              ┌───────────────┴────────────────┐
              ▼                                ▼
        kind = train                     kind = compile
      → best.pt + model.onnx          → model.hef + meta.yaml
```

Screens implied: the Train form stays; a **compile form** is reached contextually from a run or version rather than living as an empty standalone page; the runs list shows both kinds with compile runs linked to their source; and Storage gains calibration sets alongside datasets.

**Sent onward:** the split means train hyperparameters and `compile_options` now belong to *different forms* — a simplification for [06](./06-fields-vs-escape-hatch.md), which no longer has to fit both onto one page. And [07](./07-provenance-effective-config.md) gets simpler too: a HEF's provenance is its own run's record, joined to training by `source_run_id`, instead of one run row trying to describe two different executions.
