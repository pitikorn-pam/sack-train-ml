# 10 — What pins the toolchain a run is built with?

Type: grilling
Status: resolved
Blocked by: —

## Question

Raised by [01](./01-ultralytics-train-args.md). The Muon crash was not really an optimizer problem: `notebooks/train_run.ipynb` installs ultralytics **unpinned** (`%pip install --quiet ultralytics ...`) and `pyproject.toml:12` asks only for `>=8.3.0`, so a Colab session picked up 8.4.137 — a release five hours old, broken for one release only, fixed the next day in 8.4.138. Any run launched in that window was doomed by the calendar. Meanwhile the local venv sits at 8.4.56, 82 releases behind, so local and Colab were never running the same code either.

The compile side has the same shape from [02](./02-hailo-compile-params.md): this repo uses DFC 3.33.1 while Hailo pairs 3.30.0 with the HailoRT 4.20.0 the device runs.

Decide:

1. **What gets pinned, and where** — exact version, compatible range, or a lockfile; and whether the notebook, `pyproject.toml` and the DFC wheel key are pinned by one mechanism or three.
2. **Who bumps, and on what signal.** An exact pin that nobody updates rots into the 82-releases-behind problem from the other direction.
3. **Does a pin belong to the run config?** A run launched last month should arguably be re-runnable with the toolchain it originally used, which makes the version part of the run's identity rather than of the repo's — this overlaps [07](./07-provenance-effective-config.md), which records versions but does not control them.
4. **What happens when the installed version disagrees with the pin** — refuse to train, warn, or proceed and record it.

The bar this must meet: *when* a run is launched must not change *what* it does.

## Answer

*(Taken on the recommendations, under a directive to keep moving; reversible if the owner disagrees.)*

**Pin exactly, in one place, and record what actually ran.** `ultralytics==8.4.138` (the release that fixed the Muon crash) pinned in `pyproject.toml`, with the notebook installing from the repo rather than resolving `ultralytics` afresh — the unpinned `%pip install` is what let a five-hour-old broken release into a run.

**The pin is repo-level; the record is run-level.** A run does not choose its toolchain, but it must state the one it got: the installed version goes into the effective-config artifact ([07](./07-provenance-effective-config.md)). That answers "what changed between these two runs?" without needing the pin to be part of the config.

**On disagreement, refuse before training.** If the installed version differs from the pin, the run fails immediately with the mismatch named, rather than training for an hour on an untested version — and per [04](./04-where-validation-lives.md) it records what it found, so the next run's preflight warns first.

**Bumping is a deliberate act:** change the pin, run the schema-conformance test from [05](./05-schema-source-of-truth.md), and the diff in argument defaults surfaces there rather than in a training run. The DFC pin for the compile side follows the same rule but is tracked separately, since Hailo pairs DFC 3.30.0 with the HailoRT 4.20.0 on the device while this repo currently uses 3.33.1.
