# The web app, reviewed — 2026-09-07

Written from the running app plus the code, at the owner's request, to be acted on rather
than admired. Every claim names the file it came from. Ordered by weight, not by how easy
each is to fix.

Companion documents: `DESIGN.md` (the system every screen follows),
`.scratch/experiment-lab/map.md` (where the product is going and in what order),
`.scratch/experiment-lab/v1.0.0-acceptance.md` (what is measured and what is not).

---

## What is good, and should not be touched

Stated first, because the instinct with a review is to rewrite what is fine.

- **The launch path works end to end.** Create a run, Colab picks it up by `run_id`,
  metrics stream back live, artifacts land in R2, a version row appears. That is a real
  pipeline, not a scaffold, and the notebook-as-launcher discipline — config from the
  registry, never from a cell — is what keeps the executor swappable later.
- **Promotion is modelled properly.** `versions` → `channels` → `channel_deployments`
  with history, and Deploy / Set default / Undeploy in `sections/Models.tsx`. Most teams
  reach production without this and regret it.
- **Replay is unusually honest about its own limits.** It renders LOCKED panels carrying
  a reason the backend supplied rather than inventing numbers
  (`sections/Replay.tsx:1984,2015,2235,2394`), and `apps/api/lab_server.py:769` labels its
  run history `"persistent": False` out loud. That instinct is rarer than it should be
  and every new surface should inherit it. The rebuild kept it and went further: each
  locked panel now carries a badge naming what is missing — `2 RUNS REQUIRED`,
  `EVENTS REQUIRED`, `SELECT A ROW` — so the reason is legible before the panel is read.
- **The parameter contract is real, not aspirational.** One JSON file at
  `contracts/param-schema.json` genuinely *imported* by the browser
  (`lib/schema.ts`), the edge function (`_shared/contract.ts`) and the Python pipeline
  (`sack_train_ml/contract.py`) — not copied. Extend it; do not fork it.

---

## 1. The app is two halves that never meet

| | Training half | Lab half |
|---|---|---|
| Runs on | Supabase + R2 + Colab | FastAPI on one Mac, `:8077` |
| A "run" is | a `runs` row, `run_id` uuid | a lab RunManifest (`lib/labApi.ts`) |
| Can it compare two? | no | yes (`compareRunManifests`) |
| Does a result flow back? | — | **no** |

A model flows *from* the registry *into* the Lab — it has a `registry` model mode that
lists versions and fetches the signed R2 artifact (`Replay.tsx:836`). Nothing flows back.
The Lab computes exactly the numbers the registry has nowhere to store, and drops them.

`run_metrics` is `(run_id, step, name, value)` with that as its primary key, so it holds
training curves and **structurally cannot hold a second measurement** of the same model,
let alone say what footage it was measured on.

**Status:** the `evaluations`, `clips` and `suite_runs` tables now exist and are applied.
Nothing in `apps/web/src/` reads them yet. That is build steps 3–6 of the map.

## 2. There is no routing at all

`react-router` appears zero times in `apps/web/package.json`. The section is component
state: `App.tsx:33`, `useState<Section>("overview")`.

Consequences, all of them daily:

- a tab cannot be bookmarked or shared — every link opens on Overview;
- the browser back button leaves the app instead of returning to the previous tab;
- a refresh discards whatever was being configured;
- and there is no URL for a deep object, which is what makes *"is this better than what
  is deployed?"* a workflow instead of a link.

**Decided:** adopt `react-router`, not a `?tab=` shim, because the IA is about to grow to
seven sections with the Lab split in two, and the shim would be replaced inside that work.

## 3. The Lab runs a complete parallel design system

`styles.css` declares **twelve private tokens** on the `.lab-shell` rule —
`--lab-bg`, `--lab-panel`, `--lab-cyan`, `--lab-green`, `--lab-amber`, `--lab-red`,
`--lab-magenta`, `--lab-yellow` and more — then `margin:-16px` out of the app shell and
repaints the entire viewport dark. 184 CSS lines are Lab-only.

It contradicts `DESIGN.md` in four places at once: dark mode is out of scope (`:951`),
never inline hex (`:941`), no fourth surface tone (`:944`), and azure is the primary CTA
(`:890` — the Lab's is green).

**`DESIGN.md` wins on palette. The Lab wins on density** — 13px base, 30px controls — and
on every *behaviour* it invented. A research surface earns its density; it does not earn
its own colour language.

**Decided:** rebuild the Lab's UI on the system's own theme and keep the engine.

## 4. The headline number is a training metric

A version's card leads with mAP50, so a model that trains beautifully and counts badly
reads as a success. The number this team actually steers by is *counted vs ground truth
on real footage* — 380/380 — and the proxy and the goal have already diverged once in
this project's history.

**Decided** in `issues/08`: the headline becomes the measured count on named footage with
mAP50 secondary, and a version nobody has measured says **"never measured"** rather than
an em dash, because an em dash reads as zero or as loading.

## 5. One tab is doing two unrelated jobs

The old `Lab.tsx` was 649 lines because it was both an *interactive instrument* for one clip — draw
the line, drag a knob, watch the overlay — and a *results surface*: run history, baseline
vs current, event diff, count summary.

The first wants a laptop-speed loop next to the video. The second wants to be durable,
shared, and readable by someone who was not there. Keeping them in one tab is why the
results half was never persisted.

**Decided:** split into **Replay** (the instrument) and **Suites** (the results surface).

**Half done.**
`Replay` shipped at `sections/Replay.tsx`, routed at `/replay` with `/lab` redirecting so older links survive.
`Suites` does not exist yet, and until it does the results half still lives beside the instrument — the split is a rename plus a route, not yet a separation of concerns.

## 6. ~~`Lab.tsx` is not reviewable as written~~ — fixed by the rebuild

Several of its lines were 3–8 kB each. That is why a defect as simple as reading
`result.diagnostics` when the backend sends `detection_diagnostics` survived long enough
to render "DETECTOR DIAGNOSTICS LOCKED" on every successful run, with tests passing the
whole time. Formatting is not cosmetic at this size; it is the difference between a diff
someone can read and one they scroll past.

The rebuild closed this, and the numbers are the point rather than the line count.
`Lab.tsx` held 648 lines whose longest was 5,813 characters, with 34 lines over 200.
`Replay.tsx` holds 2,624 lines whose longest is 305, with 3 over 200 and a median of 38 — four times the lines and roughly a twentieth of the worst line.
A file that got *longer* is the correct outcome here: the old number was small because the content was folded, not because there was less of it.

---

## Detail-level findings still open

Each is a re-skin item rather than a defect, carried from the design audit:

- three metric line colours disagree with the documented assignment;
- the "running" status dot is the wrong blue;
- two pill variants exist that the status system forbids;
- the `pv3` form leaks off every scale in the system;
- the provenance legend's three colours are undocumented and arbitrary;
- ~~`--lab-magenta` and `--lab-yellow` are declared once and used nowhere~~ — gone with the
  rest of the private Lab palette in the rebuild;
- the dataset uploader's label column is a fixed `flex: 0 0 100px`, so "Image bundle
  (.zip) (opt)" wraps onto three lines (`styles.css:1118`). Not fixed here because the
  width is a real choice about how much of the row the label deserves, and both rows must
  keep sharing it. The mid-word break in the same label **was** a bug and is fixed —
  `word-break: break-all` was written for the R2 key and reached the `(opt)` marker
  through descendant selection, rendering it "(o pt)"; the rule is now direct-child only;
- the Runs table wraps "RUN ID" and "GIT SHA" onto two lines each, which makes the header
  row taller than its content needs (`sections/Train.tsx`). Same class of choice as above:
  column widths, not a defect.

## Deliberately NOT recommended

- **A general experiment-tracking system.** Two columns and one table cover this team's
  needs; MLflow-shaped infrastructure would cost more than it returns at this size.
- **More charts.** The training metrics are adequately served. The missing numbers are
  not training metrics.
- **Automating annotation.** Roboflow is fine and the manual step is not the bottleneck —
  finding *which* frames deserve annotating is, and `cv-missfind` already does that.
- **The Phase 2 platform work** — multi-tenant schema, a generic `train-ml-core`. The
  README's own rule is to extract a framework when a second project arrives. It has not.

## Order of work

1. **`react-router`** — affects every day, fixed once, and the Lab split needs it.
2. **Rebuild the Lab UI on the system's theme, keeping the engine.**
3. Then the map's build order, which closes findings 1, 4 and 5 together.
