# 08 — Lab as the umbrella: what happens to the existing sections?

Type: prototype
Status: resolved
Blocked by: 06

## Question

The owner chose a full redesign with the Lab as the umbrella the rest sits inside, not a
fifth peer tab. Today the app is five sections — `Overview` (157 lines), `Train` (60),
`Models` (466), `Storage` (195), `Lab` (596) — that grew as siblings, with the training half
and the Lab half meeting only in one direction: the Lab reads registry versions
(`Lab.tsx:572`) and nothing flows back.

Decide the information architecture, as a prototype to react to rather than a diagram to
approve:

- **The spine.** What is the top-level object a person navigates — the model line, the
  experiment, the run, or the clip? Everything else hangs off that choice.
- **What happens to each existing section.** Does `Train` become "launch a run" inside the
  Lab, does `Models` become the version list the Lab measures, does `Storage` survive as a
  surface at all? Name each one's fate; "we'll see" is how five sections became five
  conventions.
- **Where a person lands.** The most common question is *"is this better than what is
  deployed?"* — the design should make the diff the destination, one click from any version,
  not a workflow to assemble.
- **The headline metric.** A version's headline today is a training metric, so a model that
  trains well and counts badly reads as a success. Decide what replaces it, and what shows
  when a version has never been evaluated — that state must look obviously incomplete, not
  neutral.
- **Where `experiment_id` and `changed_lever` surface.** Two columns and a name on `runs`
  turn "one changed lever per run" from a rule people remember into something the screen
  shows; a run list grouped by experiment with the lever in its own column is most of the
  comparison UI. (Verified 2026-09-07: neither field exists in `supabase/migrations/` or
  `apps/web/src` yet.)
- **What the redesign must not lose.** `Lab.tsx` already carries line and zone drawing,
  frame range and stride, overlay export, trail display, confidence histograms,
  detections-by-class, path provenance and a reproducibility block. The engine is being
  replaced ([05](./05-where-the-shared-engine-lives.md)); this inventory of *affordances* is
  not, and each one needs a home or an explicit decision to drop it.

Uses the design system from [04](./04-design-system.md).

## Answer

*(Taken on the recommendations, under the owner's directive to keep moving. The decision half
is settled here; the prototype the ticket asks for is build step 7 in
[09](./09-where-the-lab-runs.md), after the six `DESIGN.md` sections exist to draw it with.)*

### The umbrella already had a name, decided before this map

The parameter-contract map settled it on 2026-09-03: **"Lab" names the platform**, and the
video-replay tab is one instrument inside it rather than the thing itself. The owner's answer
here — Lab as the umbrella — confirms that rather than opening it. So the product *is* the
Lab; the tabs are its instruments; `Lab.tsx` is not the Lab and must stop being named as if it
were.

### The spine is the model version

Not the run, not the experiment, not the clip. The question the product exists to answer is
*"is this model better than the one deployed?"*, and a version is the thing that gets measured,
compared and promoted. Runs produce versions. Evaluations measure versions. Clips are a
resource a version is measured against, not a spine.

The nearest rival was the experiment, and it lost for a concrete reason: an experiment groups
runs that were *trained*, but the comparison people actually make is between a candidate and
whatever is *deployed* — and the deployed one is usually from a different experiment, often
months older. A spine that cannot put those two side by side is the wrong spine.

### Each existing section, named and fated

| Today | Becomes | Fate |
|---|---|---|
| `Overview.tsx` | **Home** | Kept, re-pointed. Stops being a metrics dashboard and answers three questions: what is deployed, what is newest, and **what has never been measured**. The third is the one nothing asks today. |
| `Train.tsx` | **Train** | Kept as-is. It launches runs and it works; `NewRunV3` is the accepted design. |
| `Models.tsx` | **Versions** | Kept, re-headlined. The card's primary number becomes measured count accuracy on named footage; mAP50 drops to secondary. Promotion (`channels`, `channel_deployments`) is already modelled properly and is not touched. |
| `Storage.tsx` | **Storage** | Kept. Gains the clip library's R2 footprint, since `storage-usage` already exists and the free tier is a real budget. |
| `Lab.tsx` | **Replay** + **Suites** | **Split.** This is the substantive change. |
| — | **Clips** | New. The library: upload, scenario labels, ground truth, sets. |

**The split is the point.** `Lab.tsx` is 596 lines because it is doing two unrelated jobs:
an *interactive instrument* for one clip (draw the line, drag a knob, watch the overlay) and a
*results surface* (run history, baseline vs current, event diff, count summary). The first
wants a laptop-speed loop and belongs next to the video; the second wants to be durable,
shared, and readable by someone who was not there. Keeping them in one tab is why the results
half was never persisted — `lab_server.py:746` labels its own run history `"persistent": False`.

So **Replay** keeps the canvas, the knobs, the overlay and the frame scrubbing, and gains one
button: *commit this as an evaluation*. **Suites** owns launching a suite, reading its results,
and the comparison view with the two refusals [06](./06-what-is-a-suite-run.md) requires.

### Where a person lands: the diff, one click from any version

*"Is this better than what is deployed?"* must be a link, not a workflow. From any version:
compare against the current channel default, over the clip set that version was measured on,
with the deltas that matter. The pairing logic already exists — `compareRunManifests`
(`labApi.ts:276`) with its `ADDED IDS` / `REMOVED IDS` / `CHANGED CONFIG KEYS` view — and what
changes is that it points at two `suite_runs` and its result has somewhere to live.

Two behaviours it must gain, both currently absent in code: it must **refuse** to place two
different `config_hash` values or two different `artifact_kind` values side by side without
saying so, and `delta-value` must stop inferring "better" from the sign of the change. Fewer
missed is better; more counted is not always better. Direction is declared per metric.

### A version that has never been evaluated must look incomplete, not neutral

Today a version card shows a training metric, so a model that trains beautifully and counts
badly reads as a success. The replacement headline is the measured number — and when there is
no measurement, the card says **"never measured"** in the refusal register, not an em dash.
An em dash reads as "zero" or as "loading"; this state is neither, and the whole point of the
Home tab's third question is that this state is currently invisible.

### `experiment_id` and `changed_lever` surface as columns, not as a feature

Verified 2026-09-07: neither field exists anywhere in `supabase/migrations/` or
`apps/web/src/`. They arrive in the next migration alongside a run name. The payoff is small
and immediate — a run list grouped by experiment with the changed lever in its own column is
most of the comparison UI people ask for, and it turns the repo's one-lever-per-run discipline
from a rule someone remembers into something the screen displays.

### What the redesign must not lose

`Lab.tsx` earned its 596 lines. Every one of these is an affordance, not decoration, and each
needs a home in the new IA or an explicit decision to drop it — recorded, not forgotten:

line and exclusion-zone drawing on the canvas · frame start / end / stride · overlay export ·
trail display · confidence histogram · detections-by-class · path provenance · decision
provenance · the reproducibility block · the honest progress estimate (capped at 95% and
labelled an estimate) · LOCKED panels that name the reason instead of inventing a number ·
the 28-column events CSV · the crossing inspector.

The knobs are a different matter. The Lab's tracker controls are being replaced wholesale by
the shared engine's ([05](./05-where-the-shared-engine-lives.md)), and two of them — the inert
"Match threshold" and the silently-discarded second dedup knob — must not survive the move
under their current names. Carrying a control across a redesign is an endorsement of it.
