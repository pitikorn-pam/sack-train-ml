# Where things live, and what is about to move

The confusing part of this repo is that the Lab's counting engine (`webui/`) sits at the
root while its server (`apps/api/`) sits under `apps/`. This document says why, so nobody
has to guess — and records the two reorganisations that are worth doing, along with the
ones that are not.

Reorganising folders makes a large diff, makes review harder, and fixes nothing anybody
hit today. So the answer to "should we tidy the folders?" is: write the map, remove what
is genuinely dead, and let the scheduled work move what it was going to rewrite anyway.

---

## The map

| Path | What it is | Notes |
|---|---|---|
| `apps/web/` | The dashboard. Vite + React 19 + TypeScript. | `sections/` are the routed pages, `components/` the shared parts, `lib/` the clients and pure logic |
| `apps/api/lab_server.py` | The Lab's HTTP server. FastAPI on `127.0.0.1:8077`. | Build step 5 turns this into a worker that claims evaluation rows |
| `webui/` | The Lab's counting engine — `lab_core.py`, `lab_path.py`. | **Scheduled for replacement, not relocation.** See below |
| `src/sack_train_ml/` | The Python tool library the Colab run imports | `contract.py` is the pipeline's reader of the shared schema |
| `scripts/` | Entry points, plus three signposts that refuse | `train_for_run.py` is the one Colab calls |
| `contracts/` | `param-schema.json` — ONE schema, read by the browser, the edge function and Python | imported by all three, never copied |
| `supabase/functions/` | Edge functions. **Deno**, not Node | that is why testing them needs `deno`, not `npm` |
| `supabase/migrations/` | The schema, in order | 11 files; 10 and 11 add evaluations, clips and experiments |
| `tests/` | pytest. Also holds the cross-language guards | e.g. `test_lab_result_shape.py` compares a Python dataclass with a TypeScript type |
| `notebooks/` | Colab launchers | a notebook is a launcher, never a config holder |
| `configs/` | `*.example.yaml` for dataset / train / hailo / release | referenced by the README walkthrough |
| `docs/` | Architecture, pipeline, roadmap, testing, security, this file, the web review | |
| `DESIGN.md` | The design system every screen follows | at the root because it governs the whole product |
| `runs/` | Runtime state. Holds the Lab's task SQLite. Gitignored | see below |
| `openspec/` | A Phase 2 scaffold, three files, no active changes | left in place; it is labelled and harmless |
| `.scratch/` | Wayfinder maps, tickets and research | the decisions and their evidence |

## `webui/` stays where it is, and this is the reason

It is the obvious candidate to move — an engine at the root, away from the server that
uses it. Two facts settle it:

1. **It is scheduled for deletion, not relocation.** `.scratch/experiment-lab/issues/05`
   decided that the counting logic comes from `sack-detector-edge` as a shared package
   that both the Mac and a Pi call, so `lab_core.py`'s greedy centroid tracker goes away.
   Moving code that is about to be deleted is work with a negative return.
2. **Eight files reference it** — `pyproject.toml`, the README, and six test files put it
   on `sys.path`. Moving it now means editing all eight for tidiness alone.

When build step 5 lands, the server becomes a worker and the engine becomes a pinned
dependency. That is the moment the layout resolves itself.

## `runs/` stays where it is, and this is the reason

`apps/api/lab_server.py:60` makes `runs/lab_tasks.sqlite3` the default task database,
overridable with `LAB_TASKS_DB`. It holds the operator's **saved durable tasks**.

Changing the default path would silently orphan them — every task somebody saved would
disappear from the Lab with no error. Root tidiness is not worth that. Anyone who wants
it elsewhere can set `LAB_TASKS_DB` today.

## What was removed

- `apps/web/src/components/NewRun.tsx` — 407 lines, the retired New-run form, imported by
  nothing since `NewRunV3` replaced it. It was the clearest source of "which form is the
  real one?" confusion in the front end. The two facts it held that were still worth
  knowing are already recorded elsewhere: the working default DFC wheel key (now derived
  from the toolchain pin in `contract.dfc_wheel_key()`) and the `note` config field (which
  is why the Runs list's Note column could never populate — see `docs/web-review.md`).

- `apps/web/src/sections/Lab.tsx` and `apps/web/src/sections/Lab.defaults.test.ts` —
  superseded by `Replay.tsx` and `Replay.test.tsx`.
  The rebuild carried the engine over verbatim, so nothing imported the old file
  afterwards; leaving it would have meant two surfaces claiming to be the Lab.
  `Replay.test.tsx` is a strict superset of the old test — it keeps the per-key
  `DEFAULT_CFG` pin against `webui/lab_core.py`, the "tracker the backend cannot run"
  guard, and all four `matchDistancePx` cases, then adds about thirty-five more.
  `tests/test_events_csv.py` parses that component's source and was repointed with it.

- The 284 lines of Lab-only CSS in `apps/web/src/styles.css` — the twelve private
  `--lab-*` tokens, the dark `.lab-shell` and its `margin:-16px`, and 154 `.lab-*` rules.
  Verified dead by class name before removal, not by assumption: the only surviving
  `lab-*` strings in the front end are three download **filenames** in `Replay.tsx`
  (`lab-config.json`, `lab-events.csv`, `lab-run-<id>.manifest.json`), which are not
  selectors. `.pv3-*` and `.gate-unknown` were explicitly preserved.

## What is deliberately NOT reorganised

- **`apps/web/src/` internals.** `sections/` / `components/` / `lib/` / `styles/` is a
  conventional shape and the routing change did not disturb it.
- **`openspec/`.** Three scaffold files, clearly labelled Phase 2, referenced only in
  prose. Removing it would mean editing `CLAUDE.md`, which is the project's own
  instruction file, for a 12 kB gain.
- **Anything else.** A reshuffle is a large diff that fixes nothing observable. This
  document is the fix for the confusion it was going to address.
