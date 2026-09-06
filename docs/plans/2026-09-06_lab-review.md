# sack-train-ml — a review, and what would make experiments cheap

Written 2026-09-06 after reading the app, the registry schema and the CV toolchain.
Opinionated on purpose. Every claim below names the file or table it came from.

---

## What already works, and should not be touched

Being fair first, because the instinct with a review is to rewrite what is fine.

- **The launch path is solid.** Create a run, Colab picks it up by `run_id`, metrics stream
  back live, artifacts land in R2, a version row appears. That is a real pipeline, not a
  scaffold, and the notebook-as-launcher discipline (config from the registry, never from a
  cell) is the right call — it is what makes the executor swappable later.
- **Promotion is modelled properly.** `versions` → `channels` → `channel_deployments` with
  history, and Deploy / Set default / Undeploy actions in `sections/Models.tsx`. Most teams
  reach production without this and regret it.
- **`MetricChart`** charts loss, map50, map50_95, precision and recall with per-series
  toggles. For watching a run, it is enough.
- **The new parameter contract** (form → schema → edge function → pipeline) closes the
  class of failure that produced the Muon crash. Leave it alone and extend it.

---

## The one structural problem

**The app is two halves that never meet.**

| | Training half | Lab half |
|---|---|---|
| Where it runs | Supabase + R2 + Colab | FastAPI on a Mac, `:8077` |
| What a "run" is | `runs` row, `run_id` uuid | a lab RunManifest (`lib/labApi.ts`) |
| Where models come from | `versions` table | `/api/lab/models` (`labApi.ts:456`) |
| Can it compare two? | **No** — nothing in `sections/` or `components/` compares runs | **Yes** — `compareRunManifests`, `baselineRunId` (`sections/Lab.tsx:158`) |

The half that trains models cannot compare them. The half that can compare them does not
know the registry exists. `Lab.tsx` is 74KB — four times `Models.tsx` — because the real
work is happening there, in a parallel universe keyed by its own identifiers, backed by a
server that only runs on one laptop.

Everything below follows from this.

---

## Four gaps, in order of how much they cost

### 1. The system records how training went, not how the model performed

`run_metrics` is `(run_id, step, name, value)` with that as its primary key
(`20260526100002_runs_and_metrics.sql`). It holds training curves. It cannot hold:

- **what the model was measured on** — there is no notion of footage, a session, or a
  ground-truth set anywhere in the schema;
- **which artifact was measured** — the `.pt` and the `.hef` of one run score differently,
  and that is the whole reason INT8 work exists;
- **more than one measurement** — the primary key allows one value per name per step, so
  "this model on video A" and "the same model on video B" cannot both exist.

The number this team actually steers by is *counted vs ground truth on real footage* —
380/380 — and there is nowhere to put it. mAP50 is the proxy the dashboard shows; the
proxy and the goal have already diverged once in this project's history.

**This is a semantic gap, not a UI one.** Stuffing `name="count_accuracy"` into
`run_metrics` would store a number nobody can interpret later.

### 2. Runs cannot be grouped, named, or compared

`runs` has `config_yaml`, `status`, `git_sha`, `hardware` and timestamps — and no name, no
`experiment_id`, no note, no parent. The repo's own discipline says *one changed lever per
run* and *always compare against a baseline*; the system cannot express either. Which runs
form an ablation lives in someone's memory, and the comparison happens by opening two
browser tabs.

`docs/roadmap.md` puts "run comparison" in **Phase 2, gated on a second model line
arriving**. That sequencing is backwards: comparison is not a scaling feature, it is the
core verb of the work being done today.

### 3. The improvement loop exists — as CLI tools in another repository

In `loom-oracle/.claude/skills/` there is already a complete failure-driven loop:

```
cv-track ─▶ cv-analyze ─▶ cv-replay ─▶ cv-review ─▶ cv-missfind ─▶ cv-harvest ─▶ cv-upload
  cache      count/diff    deploy-truth   GT review   find misses    grab frames   to Roboflow
```

`cv-missfind` surfaces sacks that crossed the line and were never counted — the failures
that matter. `cv-harvest` pulls exactly those frames. `cv-upload` sends them for
annotation. That is the loop that actually improves the model, and **none of it is
connected to a `run_id` or a `version`.** A harvested frame cannot answer "which model
missed this, and did the next one fix it?"

### 4. The Lab runs on one laptop

`/api/lab/*` is served by `apps/api/lab_server.py` on `127.0.0.1:8077`. The most valuable
analysis surface in the product is unavailable to anyone but the person whose Mac it is,
and disappears when that Mac sleeps.

---

## What to build, in order

The theme: **connect what exists before building anything new.** Three of the four gaps are
integration problems, not missing features.

### First — give an evaluation somewhere to live

One table. An evaluation is *(model artifact) × (footage) → (numbers, verdict)*:

```
evaluations
  id, run_id, version_id, artifact_kind        -- WHICH model, .pt or .hef
  footage_ref, ground_truth_ref                -- WHAT it was measured on
  metrics jsonb                                -- counted, expected, missed, false, precision…
  verdict, notes, created_at, created_by
```

Everything else on this list becomes possible once this exists, and nothing else does
until it does. It is also the natural home for the INT8-vs-FP32 measurement the parameter
contract requires but has nowhere to record.

### Second — make an experiment a thing

`experiment_id` and `changed_lever` on `runs`, plus a name. Two columns and a text field
turn "one lever per run" from a rule people remember into something the system shows. A
run list grouped by experiment, with the lever in its own column, is most of the
comparison UI people ask for.

### Third — one comparison view, reachable from both halves

The Lab already computes comparisons. Point it at registry versions instead of only lab
manifests, and surface the result on the run and version pages: **baseline vs candidate,
same footage, the deltas that matter** — counted, missed, false, and the frames where they
disagree. Not two tabs.

### Fourth — close the harvest loop through the registry

`cv-missfind` → `cv-harvest` → `cv-upload` already works. What is missing is the thread:
a harvested frame should record the evaluation it came from, and a dataset should record
which harvests fed it. Then "we added 141 drag-pose frames after run X missed them, and
run Y fixed 9 of them" is a query rather than an anecdote.

`data_assets` (migration 08) is the right place to hang this.

### Fifth — move the Lab off the laptop

Only once the above have shape. Its value multiplies when it can read the registry, and
that is the change that makes hosting it worth the trouble.

---

## UX, specifically for this work

- **Show the goal metric, not just the proxy.** A version's headline should be its
  measured count accuracy on named footage, with mAP50 secondary. Today the headline is a
  training metric, and a model that trains well and counts badly looks like a success.
- **Every number needs its provenance inline.** This project has already lost hours to a
  number whose source nobody could name. Any metric shown should say what it was measured
  on and with which artifact, in the same view, without a click.
- **Make the diff the destination.** The most common question is "is this better than what
  is deployed?" That should be one click from any version, not a workflow.
- **Deployment should read back.** `channel_deployments` records what was sent; nothing
  records what happened afterwards. A deployed version with no field result looks
  identical to one that is working.
- **Keep the refusal pattern.** The New-run form blocks known-broken paths and names the
  mechanism. Apply the same standard everywhere: refuse with a reason, never warn and
  proceed.

---

## What not to build

- **The Phase 2 platform work** — multi-tenant schema, a generic `train-ml-core`, per-project
  notebook templates. The README's own rule is to extract the framework when a second
  project arrives. It has not. Every hour there is an hour not spent on the loop above.
- **More charts.** The training metrics are adequately served. The missing numbers are not
  training metrics.
- **A general experiment-tracking system.** Two columns and one table cover this team's
  needs. MLflow-shaped infrastructure would cost more than it returns at this size.
- **Automating annotation.** Roboflow is fine and the manual step is not the bottleneck —
  finding *which* frames deserve annotating is, and `cv-missfind` already does that.

---

## The one-line version

The pipeline can train and ship a model but cannot tell you whether it is better than the
last one. Give evaluations a home, give runs an experiment to belong to, and connect the
CV tools that already exist to the registry that already exists — then the Lab is a lab.
