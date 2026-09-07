# 03 — What is a scenario clip, and where does its ground truth come from?

Type: grilling
Status: resolved
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

## Answer

*(Taken on the recommendations, under the owner's directive to keep moving; each choice names
its alternative so it can be overturned without re-deriving it.)*

**A clip gets its own table, not a `data_assets` row.** `data_assets` exists for things
uploaded once and reused where the only question is *are these the same bytes* — datasets and
calibration sets. A clip is asked a different question: *where is the line, what is the truth,
how many frames are there really.* Those are columns, not a jsonb bag behind a discriminator,
and `evaluations.clip_id` needs a real foreign key to point at. `data_assets` keeps datasets
and calibration sets; the R2 upload path is shared, the record is not.

```sql
create table public.clips (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,

  -- The bytes.
  r2_key            text not null,
  sha256            text not null unique,
  bytes             bigint not null,

  -- Measured, never assumed. `probe` holds the raw ffprobe output these came from.
  fps               numeric not null,
  frame_count       integer not null,
  width             integer not null,
  height            integer not null,
  probe             jsonb  not null,

  -- Geometry: where counting happens in this clip.
  line              jsonb,                        -- {x1,y1,x2,y2}; null = not fitted yet
  inflip            boolean not null default false,
  exclusion_zones   jsonb  not null default '[]'::jsonb,

  -- Truth.
  gt_kind           text not null default 'none'
                      check (gt_kind in ('none','count','per_crossing')),
  expected_count    integer,
  gt_ref            text,                         -- artifact key for per-crossing truth
  gt_source         text,                         -- how truth was established, in words
  gt_established_at timestamptz,
  gt_established_by uuid references auth.users(id) on delete set null,

  -- Where the clip itself came from.
  provenance        jsonb not null,
  source_clip_id    uuid references public.clips(id) on delete set null,
  trim_start_frame  integer,
  trim_end_frame    integer,

  notes             text,
  archived          boolean not null default false,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),

  -- fps and frame count must come from a real probe, not from a duration multiplication.
  constraint frame_count_is_measured check (probe ? 'nb_read_packets'),
  -- Truth kinds carry their own obligations.
  constraint gt_count_needs_a_number
    check (gt_kind <> 'count' or expected_count is not null),
  constraint gt_per_crossing_needs_both
    check (gt_kind <> 'per_crossing' or (expected_count is not null and gt_ref is not null))
);

create table public.scenarios (
  slug        text primary key,
  label       text not null,
  description text not null
);

create table public.clip_scenarios (
  clip_id  uuid not null references public.clips(id) on delete cascade,
  scenario text not null references public.scenarios(slug) on delete restrict,
  primary key (clip_id, scenario)
);
```

**Scenario labels are a controlled vocabulary in a table, and a clip can carry several.** Free
tags were rejected because the entire value of the library is asking *"how does this model do
on the occlusion clips"* — a question free tags answer only by luck, once somebody has typed
`occlusion`, `occluded` and `occlussion`. An enum was rejected too, because a new situation
would then need a migration. A table gets both: answerable labels, and adding one is an
insert. Seed it from the situations this project has actually chased:

`occlusion` · `stacked` · `carried` · `adjacent-container` · `low-light` · `weather` ·
`fast-throughput` · `person-crossing` · `camera-shift` · `clean-baseline`

`clean-baseline` earns its place: a library of only hard clips cannot tell you that a change
broke the easy case.

**Ground truth: `cv-review` stays the producer of per-crossing truth; a total count may be
established in the Lab.** Building a second annotation tool was rejected outright — the
existing route (`cv-review` → `golden_test_set` in `loom-oracle/.claude/skills/`) works and is
where the review UI already lives. But requiring a CLI in another repository before a clip can
be measured at all is friction that would stop the library from ever being populated, and the
Lab already has a "GT target" field that does exactly this.

So the two kinds split by who can establish them:

| `gt_kind` | Who establishes it | What it unlocks |
|---|---|---|
| `count` | a person, in the Lab, after watching the clip | `counted` vs `expected`, accuracy, comparison |
| `per_crossing` | `cv-review` → `golden_test_set`, imported | additionally `missed` and `false_positive`, and `cv-missfind` |
| `none` | — | the clip can be replayed and eyeballed, but produces no verdict |

**A count-only clip is first-class, not second-class.** `evaluations.missed` and
`false_positive` are already nullable for exactly this reason
([02](./02-what-is-one-evaluation.md)), so the schema does not punish a clip for having cheap
truth. What it must never do is let a per-crossing metric appear for a clip that cannot support
one — hence the nullability rather than a zero.

**A human typing the ground truth is not a provenance violation — and this needs saying,
because it looks like one.** The parent `CLAUDE.md` provenance gate stamps a *hand-typed count
line* UNVERIFIED. That rule is about the **measured** count, the number the machine produced
and that gets reported. Ground truth is by definition human-established; that is what makes it
truth. The gate applies to `evaluations.counted`, never to `clips.expected_count`. Both facts
live in the record: `gt_source` says how truth was established, and `evaluations.provenance`
says how the measurement was.

**fps and frame count are measured and the proof is stored.** `duration × r_frame_rate` lies,
and has already cost this project a wrong count; the established method is
`ffprobe -count_packets` with `avg_frame_rate`. Rather than trust the ingest tool to have done
it, the raw probe output is stored in `probe` and a check constraint requires
`nb_read_packets` to be present — so a row whose frame count was guessed cannot be inserted at
all. Same principle as the `reportable` gate: a guardrail in the schema, not a reminder in a
README.

**Trims point back at their source.** `source_clip_id` plus `trim_start_frame` /
`trim_end_frame` means a short clip cut from a long recording can always be traced back, and
two trims of the same footage are visibly related rather than looking like independent
evidence. This is the exact failure the 2026-08-05 "bridge +1" incident was: a count reported
off a clip assembled from hand-picked frames.

**Getting clips in: a CLI that presigns and pushes, with web upload for small ones.** The R2
machinery already exists — `_shared/r2.ts::presignGet`, the `upload-dataset` /
`download-tool` functions — so this is wiring, not new infrastructure. The long source videos
stay on the owner's machine; only trimmed clips go up, which is what keeps the library inside
R2's free tier. The `storage-usage` edge function already exists and becomes the budget
readout rather than something new.

**The runner caches locally, keyed by sha256; it does not stream.** An evaluation reads a clip
frame by frame, many times over a suite. Streaming from R2 per run would be slow even though
egress is free. A content-addressed local cache has no invalidation problem — the key *is* the
content — and it is the same shape as the existing `_cv_cache` the CV skills already use at
`~/Work/BSCP/vdo_train/_cv_cache`.
