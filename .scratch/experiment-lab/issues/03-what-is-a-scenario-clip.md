# 03 — What is a scenario clip, and where does its ground truth come from?

Type: grilling
Status: open
Blocked by: —

## Question

The owner will supply footage — long videos and short trimmed clips covering different
situations. Without a ground-truth number per clip, "measuring a model" has no yardstick,
so the clip and its truth are one design problem.

Settled already (map Notes): trimmed clips live in **R2** (`_shared/r2.ts::presignGet` is
the existing, working path); long source videos stay off the cloud. What is not settled:

- **The record.** `data_assets` (migration `20260905100008_profiles_and_data_assets.sql`)
  already exists for things uploaded once and reused, with a `kind` discriminator, and was
  built so two compiles can be shown to have used identical images. Does a clip become a
  `data_assets` row, or does footage need its own table? Weigh what a clip carries that a
  dataset does not: a count line, exclusion zones, fps, frame count, an inflip.
- **The scenario label.** Free tags, or a fixed vocabulary (occlusion / stacked / carried /
  night / adjacent-container)? The value of the library is asking "how does this model do
  on occlusion clips" — that only works if the labels are answerable, and only if a clip
  can carry more than one.
- **Where ground truth comes from.** The existing route is `cv-review` → `golden_test_set`
  in `loom-oracle/.claude/skills/`. Does that stay the producer of truth, with the Lab
  merely referencing it, or does GT get entered and reviewed in the Lab? Do **not** design
  a second annotation tool without deciding the first one is wrong.
- **What GT actually is.** A single expected count per clip is the cheapest and matches the
  Lab's existing "GT target" control. A per-crossing list with frame numbers costs far more
  to produce but is the only thing that distinguishes *missed* from *false* — and the
  failure-driven loop (`cv-missfind`) needs that distinction. Decide whether the record
  supports both from the start, and whether a count-only clip is second-class.
- **fps and frame count, measured not assumed.** `duration × r_frame_rate` lies; the
  established method is `ffprobe -count_packets` with `avg_frame_rate`. This has cost this
  team a wrong count before, so it belongs in the clip record as a measured field.
- **Getting clips in.** Upload through the web app, or a CLI that presigns and pushes? How
  big is the library allowed to get before R2's free tier stops being free, and does the
  eval runner stream from R2 or cache locally?
