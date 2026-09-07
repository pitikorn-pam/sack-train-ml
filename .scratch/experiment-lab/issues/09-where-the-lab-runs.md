# 09 — Where does the Lab run, and what is its relationship to the `cv-*` CLI skills?

Type: grilling
Status: resolved
Blocked by: 05, 06

## Question

Two questions that turn out to be one, because both are about which machine holds the truth.

**Where it runs.** `apps/api/lab_server.py` serves `/api/lab/*` on `127.0.0.1:8077` with
`device_default: "mps"` — the most valuable analysis surface in the product is available to
one person and disappears when that Mac sleeps. A suite run
([06](./06-what-is-a-suite-run.md)) over a whole clip library makes this sharper: it is long,
it is repeatable, and it should survive a closed laptop. Weigh: stay local (heavy video
processing where the hardware and the files are); move server-side (available to everyone,
but GPU cost and clip upload become real); or hybrid — results, comparison and queue in the
cloud, processing wherever the hardware is, which is already forced by
[07](./07-portable-hef-runner.md), since `.hef` can only run on a Pi.

**The `cv-*` skills.** A complete failure-driven loop already exists in `loom-oracle`:
`cv-track` → `cv-analyze` → `cv-replay` → `cv-review` → `cv-missfind` → `cv-harvest` →
`cv-upload`. It is the loop that actually improves the model, it is where ground truth and
deploy-truth replay already live, and **none of it is connected to a `run_id` or a
`version`** — a harvested frame cannot answer "which model missed this, and did the next one
fix it?"

Decide the relationship: absorb the loop into the Lab; keep the CLI and have both write to
one `evaluations` table; or retire the CLI. Consider that these tools are how the owner and
the sibling Oracles actually work today, that they carry the provenance gate
(`_cv_lib/provenance.py::assert_reportable`) which the Lab does not yet have, and that
`cv-replay` is the proven `.hef` path [07](./07-portable-hef-runner.md) is built on.

Whatever wins must say **which component owns the provenance gate** once counts can be
produced by a web app, a CLI, and a Pi — three producers, one refusal rule.

The last part of this ticket produces the **build order**: with every decision on this map
settled, the sequence in which the pieces get built, so implementation starts without
re-deciding anything. That is where this map ends.

## Answer

*(Taken on the recommendations, under the owner's directive to keep moving.)*

### Where it runs: hybrid — and it was decided by other tickets, not chosen here

[07](./07-portable-hef-runner.md) puts `.hef` measurement on a Pi because that is where the
silicon is. [06](./06-what-is-a-suite-run.md) makes a suite a queue of claimable rows. Between
them the answer is already fixed:

| Layer | Where | Why |
|---|---|---|
| The record — clips, suites, evaluations, comparison | Supabase | It is already there, it already has auth and RLS, and a result nobody else can read is not a result. |
| The UI | the deployed web app | The most valuable analysis surface in the product currently disappears when one Mac sleeps. |
| `.pt` processing | the Mac, as a worker | Video decode wants to be near the files and the GPU; `device_default: "mps"` already is. |
| `.hef` processing | any Pi with `/dev/hailo0`, as a worker | Only place it can run. |

**`apps/api/lab_server.py` stops being "the Lab backend" and becomes "the Mac worker".** That
is the whole change, and it is smaller than moving the Lab to a server: the FastAPI process
keeps doing what it is good at — decoding video fast, next to the files — and stops being the
thing the UI depends on being awake. The browser talks to Supabase. It talks to the local
worker only for the one interaction that genuinely needs a laptop-speed loop: scrubbing a
single clip while dragging the count line. Even then, the result of a *committed* run lands in
`evaluations` like every other.

`lab_server.py:746` already labels its run history `"persistent": False` out loud. This ticket
is what finally makes that label untrue.

### The `cv-*` skills: keep them, and give both paths one table

Option (b). Absorb was rejected and drop was rejected, for reasons that are facts rather than
preferences:

- They are how the owner and the sibling Oracles actually work today.
- They carry the provenance gate — `_cv_lib/provenance.py::assert_reportable` — which the web
  Lab has never had.
- `cv-replay` is the proven on-device `.hef` path that [07](./07-portable-hef-runner.md) is
  built on. Dropping the CLI would mean rebuilding the thing the runner depends on.

What changes is that they stop being a parallel universe. Every `cv-*` run that produces a
count writes an `evaluations` row with `runner = 'lab-cli'`, carrying the same
`artifact_sha256`, `clip_id`, `config_hash` and `engine_version` as a web-launched run. That is
what finally makes *"we added 141 drag-pose frames after run X missed them, and run Y fixed 9 of
them"* a query instead of an anecdote — the harvest loop's missing thread was never the tools,
it was that nothing they produced had a `run_id` to hang on.

Two consequences the skills must absorb:

1. **`cv-replay` must call the lifted package**, not its own passthrough at
   `cv_replay.py:199`. Until it does, it is not deploy-truth on the confirm/flag split despite
   its `SKILL.md` saying so, and wiring it to `evaluations` first would only give the
   discrepancy a table to live in.
2. **`cv-track` / `cv-analyze` keep their cache-based analysis role.** They answer different
   questions than an evaluation does and should not be forced through the same record.

### Who owns the provenance gate, now that there are three producers

A web app, a CLI, and a Pi can each produce a count. One refusal rule, three layers, and the
authority is the layer that cannot be bypassed:

| Layer | What it is | What it is for |
|---|---|---|
| `_cv_lib/provenance.py` | client-side pre-check | fails a CLI user fast and locally, before a long run |
| `submit-evaluation` | the edge function | assembles the provenance block from reported facts and is the **only** thing permitted to set `reportable = true` |
| the CHECK constraint | `evaluations_reportable_requires_provenance` | the floor. A row that lies cannot be inserted at all, by anyone, including a future producer nobody has thought of |

The gate does not move to the edge function; it is *enforced* there and *bounded* by the
database. The parent `CLAUDE.md` is explicit that nine of nine sessions failed to follow a
written rule and only a mechanical gate ever helped — so the authority belongs to the layer
that cannot be forgotten, and that is the constraint.

---

## The build order — where this map ends

Every decision is settled. What follows is the sequence, and nothing on it requires a new
decision. Two open items block step 2 and are named where they bite.

| # | Step | Depends on | State |
|---|---|---|---|
| 0 | Migration 10 — clips, scenarios, clip_sets, suite_runs, evaluations | 02, 03, 06 | **written**, not applied |
| 1 | Apply migration 10; seed the scenario vocabulary | 0 | pending — the live-DB write was refused by the sandbox and needs the owner |
| 2 | Lift the counting package out of `sack-detector-edge`, pin it, publish `pipeline.py` | 01, 05 | **blocked** — see below |
| 3 | `claim-evaluation` + `submit-evaluation` edge functions; provenance enforcement | 1, 2 | ready after 2 |
| 4 | Clip ingest: presign, upload, `ffprobe -count_packets`, GT entry | 1, 3 | ready after 1 |
| 5 | `lab_server.py` becomes the Mac worker; results land in `evaluations` | 2, 3 | ready after 3 |
| 6 | Lab UI: launch a suite, read results, baseline-vs-candidate with its two refusals | 4, 5 | ready after 5 |
| 7 | The six `DESIGN.md` sections, then re-tokenise `Lab.tsx` | 04 | **the sections are unblocked now**; the re-tokenise is its own large mechanical diff |
| 8 | The portable `.hef` runner + `provision_eval_box.sh` | 2, 3 | ready after 3 |
| 9 | Rewire `cv-replay` onto the package; `cv-*` write `evaluations` rows | 2, 3 | ready after 3 |

Running alongside, dependent on none of it: fixing the demonstrated defects D-01…D-33 from
`v1.0.0-acceptance.md`, and standing up the web and edge-function test harnesses that do not
exist. Those are the larger half of "all functions working, all testcase" and they start now.

**Step 2 is blocked on two questions the counting-stack investigation was asked and did not
answer:**

1. ~~**Does `RegionManager`'s flagged ledger lift?**~~ **Resolved 2026-09-07: yes,
   cleanly.** The vocabulary sounds like transport — `flag_event`, `flagged_id`,
   `session_id` — but the module is transport-free: no MQTT, no SQLite, no journal, a
   plain in-memory dict (`line_counter.py:481`), and `session_id` arrives as a parameter
   from the glue layer (`detection_loop.py:1494`). What it holds is *review state*, which
   the Lab needs too. Carry `line_counter.py` whole — see
   [05](./05-where-the-shared-engine-lives.md).

2. ~~**What are the deployed knob values, read from a running container?**~~ **Resolved
   2026-09-07.** Read from edge003 via `docker inspect` / `docker exec`. `match_thresh` is
   an **IoU threshold** in the deployed file's own words; the Lab's numeric defaults match
   the device exactly, so the lift migrates semantics rather than values; `scorer.passthrough`
   is `false` on the live machine, confirming cv-replay is not deploy-truth; and no counting
   knob is set in the environment at all. Full table in
   [05](./05-where-the-shared-engine-lives.md).

**Both are now closed**, and they were exactly the kind of thing that is cheap before the
package is cut and expensive after. Step 2 is unblocked.
