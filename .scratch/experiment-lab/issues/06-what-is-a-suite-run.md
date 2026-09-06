# 06 — What is a suite run, and what does it produce?

Type: grilling
Status: open
Blocked by: 02, 03

## Question

The Lab's job, in the owner's words: get a model, have sample videos covering many
situations, run them to see how detection behaves, and edit config as **pipeline
automation** rather than one hand-driven run at a time. Automation level **A** is in scope —
one model across the whole clip library, one click — with B (a config matrix) and C (firing
when training finishes) designed for but not built.

Given an evaluation record ([02](./02-what-is-one-evaluation.md)) and a clip library
([03](./03-what-is-a-scenario-clip.md)), settle what sits above them:

- **Is a suite run a stored entity or just a filter?** A `suite_runs` row grouping N
  evaluations, or N evaluations sharing a tag? The stored version can hold "12 of 14 clips
  done, 1 failed"; the filter version cannot, and cannot be resumed.
- **What the library is at run time.** All clips, a saved selection, or clips matching a
  scenario tag? Saved selections are how "the occlusion suite" becomes something you re-run
  against every new model.
- **Partial and failed clips.** One clip fails to decode: does the suite report a number?
  The parent `CLAUDE.md` is unambiguous — a finalization state that is not clean is not a
  result — so decide how an incomplete suite is *displayed*, since it must not be able to
  look like a clean one.
- **The headline.** What single number, if any, does a suite produce — total counted versus
  total GT, mean per-clip accuracy, or a refusal to reduce it at all? These disagree
  whenever clip lengths differ, and the choice decides what people will optimise for.
- **Comparison, which is the actual verb.** Baseline versus candidate over the same clip
  set: the same numbers side by side, per clip, with the deltas that matter (counted,
  missed, false) and a way to reach the frames where they disagree. `compareRunManifests`
  and the `ADDED IDS` / `REMOVED IDS` / `CHANGED CONFIG KEYS` view in `labApi.ts:276` already
  do this between two lab manifests — decide how much of it survives and what it points at
  now.
- **Execution.** Serial or parallel, and where the queue lives; whether a suite is resumable
  after the machine sleeps, given that the current backend is a laptop.
- **The seam for B and C.** What a suite run must carry so a config matrix and a
  train-completion trigger fit later without reshaping the record.
