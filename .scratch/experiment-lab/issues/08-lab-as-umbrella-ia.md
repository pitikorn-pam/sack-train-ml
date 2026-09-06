# 08 — Lab as the umbrella: what happens to the existing sections?

Type: prototype
Status: open
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
