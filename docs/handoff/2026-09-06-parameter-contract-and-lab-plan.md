# Handoff — 2026-09-06

Written before a context compaction. Everything a fresh session needs to continue without
redoing work or re-asking Pam what was already settled.

---

## 1. Where things stand

Two efforts ran today. **The parameter-contract effort is finished and shipped.** The
**Lab redesign is not started** and is blocked on four questions Pam has not answered yet
(§5).

Everything is committed and pushed to `origin/main` in `sack-train-ml`
(`pitikorn-pam/sack-train-ml`). Nothing is uncommitted.

---

## 2. What shipped (parameter contract)

The wayfinder map at `.scratch/train-param-contract/` is **13/13 resolved**. The
consolidated spec is `docs/training-parameter-contract.md` — read that before touching any
of this; it is the decisions, not the narrative.

Working code, all verified:

| Piece | Where |
|---|---|
| Single schema, three readers | `contracts/param-schema.json` — web (Vite alias `@contracts`), edge fn (direct import), Python (`src/sack_train_ml/contract.py`) |
| The New-run form, generated from it | `apps/web/src/components/NewRunV3.tsx`, mounted in `sections/Train.tsx` |
| Server-side enforcement (the authority) | `supabase/functions/_shared/contract.ts` → wired into `start-training/index.ts`, returns 422 with issues |
| Toolchain pin + refusal | `pyproject.toml` (`ultralytics==8.4.138`), `train_for_run.py::check_toolchain` |
| Head index derived, not hardcoded | `scripts/compile_clientrunner.py::_head_index` |
| Provenance layer 3 | `train_for_run.py::_write_effective_config` → uploaded as `effective_config` artifact |
| Saved profiles + reusable datasets | migration 08, `apps/web/src/lib/profiles.ts` |

**Tests that must keep passing:**

```bash
cd apps/web && npm run build            # tsc + vite
node contracts/verify-contract.mjs      # 11 cases, the server-side validator
.venv/bin/python -m pytest tests/test_contract.py -q   # 6 cases, schema vs ultralytics
```

**Migrations 08 and 09 are applied to the live database** (verified by query: 3 built-in
presets seeded, `runs.requested_config` exists as jsonb).

---

## 3. The INT8 investigation — nearly closed

The original problem: a model at 0.85–0.97 FP32 confidence produced a HEF that did not
detect. Suspects eliminated **in this order, each by evidence**:

1. **Missing cls sigmoid** — eliminated. DFC applies it itself as part of
   `nms_postprocess`, recorded in the HAR's `probe.modifications_meta_data.json` as
   `"sigmoid_layers": ["conv54","conv65","conv80"]` — exactly the three `cls_layer`
   entries of the bbox decoders. Full record: `.scratch/train-param-contract/issues/11-*`.
   **Do not re-check this via a layer's `activation` field or via output layers** —
   `nms_postprocess` collapses the six head outputs into one, so the cls convs stop being
   outputs and their `activation` stays `None` either way. That wrong test produced the
   opposite verdict once.
2. **Box decoder / `regression_length`** — eliminated from HailoRT source: wrong values
   give bad boxes with *healthy* scores.
3. **Normalization** — eliminated: matches what ultralytics expects.
4. **Quantization itself at opt-0** — eliminated today. FP32 17 detections @ 0.934 vs INT8
   15 @ 0.918 on identical frames; ~2% loss. Evidence:
   `.scratch/train-param-contract/evidence/2026-09-06_fp32-vs-int8-opt0.md`.

**Remaining suspect: `optimization_level: 2`.** An ablation (opt-0 vs opt-2, same model,
same 1024 real frames) was **still running at handoff** — see §4.

Also established: **synthetic calibration frames make DFC refuse to quantize outright**
(`NegativeSlopeExponentNonFixable`), not merely degrade. Real frames cleared it.

---

## 4. In flight at handoff

**The opt-0 vs opt-2 ablation, on Colab.** Script `/content/opt_ablation.py`, log
`/content/ablation.log`. opt-0 finished: `above_th=16 max=0.918`. opt-2 was at `Epoch 1/4`
— QAFT literally training inside the compile, which is itself confirmation of what
optimization level 2 does.

To pick it up: `colab_exec` with
`grep -E "INT8 opt-|VERDICT|FAILED" /content/ablation.log`.

**The Colab session will not survive.** It was reconnected several times already. If it is
gone, the run is repeatable but costs ~15 min of setup: the DFC wheel comes from R2 via the
`download-tool` edge function (signed URL, then `curl` on Colab — 13 seconds for 489MB),
the venv must be built on **`/usr/bin/python3.10`** (not 3.13 — numpy 1.23.3 has no wheel
for it), and calibration frames are at
`~/.claude/jobs/*/tmp/calib1024.tgz` or regenerable from
`loom-oracle/ψ/active/2026-08-31_capcut-frame-extract/raw2`.

A survey subagent (`survey-webapp`) was dispatched and **never produced its file**. It was
abandoned; the review was written from direct reading instead. Do not wait on it.

---

## 5. Open — the Lab redesign

Pam's instruction: *"ทำฝั่งเทรนให้ดี, ฝั่ง lab refactor+redesign ยกระบบใหม่"* — make the training side
good, and rebuild the Lab side to fit how it is actually used.

The review is `docs/plans/2026-09-06_lab-review.md`. Read it; it has the evidence. Its
central finding, **after a correction**:

> The bridge between the training half and the Lab half is **half-built, inbound only.** The
> Lab *does* read the registry — it has a `registry` model mode that lists `versions` and
> fetches the signed R2 artifact (`Lab.tsx:572`). What is missing is the return path: the
> Lab computes exactly the numbers the registry has nowhere to store, and drops them.

Sharpest supporting facts:

- `run_metrics` PK is `(run_id, step, name)` — training curves only. No footage concept, no
  artifact link, and structurally **cannot hold a second measurement** of the same model.
- `runs` has no name, no `experiment_id`, no changed-lever field.
- Lab registry mode fetches **`artifacts.pytorch`** while the device runs the `.hef` — the
  evaluation tool measures a different artifact than the deployed one.
- The complete failure-driven loop already exists as CLI skills in `loom-oracle`
  (`cv-missfind` → `cv-harvest` → `cv-upload`), connected to no `run_id`.
- `docs/roadmap.md` puts run comparison in Phase 2 gated on a second project — backwards.

### The four questions Pam has NOT answered

Asked at the end of the session; she asked for this handoff instead of answering. **Ask
again after the recap; do not assume the recommendations.**

1. **What is the Lab's job in one line?** (a) a knob-tuning tool on video, (b) the
   evaluation surface that produces the verdict and writes it to `evaluations`, (c) both.
   *Recommended (b)*, with knob-tuning as the means rather than the destination.
2. **Should it measure the `.hef` or the `.pt`?** *Recommended: support `.hef`, and always
   label which artifact a number came from* — mixing artifacts unlabelled is the same bug
   class chased all day.
3. **Where does it run?** (a) stays local FastAPI on the Mac, (b) server-side, (c) hybrid —
   results and comparison in the cloud, heavy processing wherever the hardware is.
   *Recommended (c)*, because `.hef` replay needs a machine with Hailo.
4. **Relationship to the `cv-*` CLI skills?** (a) absorb into the Lab, (b) keep the CLI and
   have both write to one `evaluations` table, (c) drop the CLI. *Recommended (b)*.

### Train side — decided, just needs doing

No questions outstanding. In order:

1. **`evaluations` table** — *(model artifact) × (footage) → (numbers, verdict)*. This is
   the foundation of both tracks; nothing else on either list works without it. Proposed
   shape is in the review under "First".
2. `experiment_id` + `changed_lever` + a name on `runs`.
3. Compile as its own run kind, one launcher notebook (decided in issue 08, unbuilt).
4. Calibration sets as R2 artifacts referenced by key (decided in issue 08, unbuilt —
   `compile_options.calib_dir` currently takes a disk path, which is not reproducible).

---

## 6. Environment facts worth not rediscovering

- **GitHub accounts differ per repo.** `sack-train-ml` → `pitikorn-pam`; `loom-oracle` →
  `ppitikorn`. `gh auth switch --user pitikorn-pam` before pushing this repo, or the push
  401s. This bit twice today.
- **Supabase migrations can now be applied without Pam.** Her `SUPABASE_ACCESS_TOKEN` in
  `.env` was regenerated and works. Apply SQL with
  `POST https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query`,
  bearer that token. Project ref is `eccwaoouvusinuvuybsr` (20 chars — an earlier session
  mis-read a grep line number and appended a `5`). Cloud project name is
  `ipassion-model-registry`, which differs from `config.toml`'s `bscp-model-registry`.
- **`supabase db push` does not work** — it wants `SUPABASE_DB_PASSWORD`, which is not
  stored and which Supabase will not show again.
- `colab_upload` caps at **50MB**. Larger files go via a signed R2 URL and `curl` on Colab.
- The dev server runs at `http://localhost:5173`; `?preview=1` renders the app shell
  without a session (dev builds only) for screenshotting.

---

## 7. Mistakes made today, recorded so they are not repeated

Three, all the same shape — **reporting before opening the artifact**:

1. **The sigmoid conclusion was published from log lines** before any artifact was
   inspected, and committed. The answer happened to survive when the HAR was finally read,
   but the confidence at the time was unearned. The probe's own verdict then said the
   *opposite*, because it read the wrong field.
2. **The review claimed the Lab does not know the registry exists.** It does. Corrected in
   `0c2b5ff`, but it was the review's central claim and it was written from greps rather
   than from reading `Lab.tsx`.
3. **An FP32-vs-INT8 comparison reported "0 detections"** because the output was parsed on
   the wrong axis — the NMS output is `(batch, classes, 5, proposals)`, with the 5 on axis
   2, not the last. Inspecting the actual shape fixed it.

The pattern: greps and logs are narration; artifacts are evidence. Open the artifact before
saying the thing.

---

## 8. Commits from this session

`367fe15` AdamW pin · `dc3dbb2` calib_dir override · `d9e198a` map charted · `54cd138` Lab
horizon · `da2c879` sigmoid probe cell · `91ae04c` catalogue from official docs ·
`7ccf8fe` validation ownership · `e096d8c` the New-run form · `09a73bd` profiles + data
assets · `2ea7c6c` sigmoid answered · `8a943de` sigmoid check corrected · `e8f91f9` opt-0
evidence · `4a8f4a2` toolchain pin + head index · `c59cee4` Python contract reader ·
`99c8609` effective config recorded · `ab45388` the review · `0c2b5ff` review corrected
