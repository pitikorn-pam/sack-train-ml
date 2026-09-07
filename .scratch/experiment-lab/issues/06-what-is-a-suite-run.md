# 06 — What is a suite run, and what does it produce?

Type: grilling
Status: resolved
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

## Answer

*(Taken on the recommendations, under the owner's directive to keep moving.)*

**A suite run is a stored entity, not a filter over evaluations.** It has to be able to say
*"12 of 14 done, 1 failed"* and it has to survive a closed laptop — a filter can express
neither. It is also the smallest thing that makes "run this model over the library" one click,
which is the owner's stated ask: a measuring instrument, not a hand-driven run at a time.

```sql
create table public.clip_sets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  archived    boolean not null default false,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.clip_set_members (
  clip_set_id uuid not null references public.clip_sets(id) on delete cascade,
  clip_id     uuid not null references public.clips(id)     on delete restrict,
  primary key (clip_set_id, clip_id)
);

create table public.suite_runs (
  id              uuid primary key default gen_random_uuid(),
  name            text,

  -- WHICH model — the same identity an evaluation carries, fixed for the whole suite.
  version_id      uuid references public.versions(id) on delete set null,
  run_id          uuid references public.runs(id)     on delete set null,
  artifact_kind   text not null check (artifact_kind in ('pt','hef','onnx')),
  artifact_ref    text not null,
  artifact_sha256 text not null,

  -- WHAT it ran over. clip_set_id is provenance; clip_ids is the resolved list, snapshotted
  -- at launch so that editing the set later cannot rewrite history.
  clip_set_id     uuid references public.clip_sets(id) on delete set null,
  clip_ids        uuid[] not null,

  -- HOW it counted.
  engine_version  text not null,
  config          jsonb not null,
  config_hash     text not null,

  -- Progress. Derived from the child evaluations, stored so the UI need not aggregate to render.
  status          text not null default 'pending'
                    check (status in ('pending','running','complete','incomplete','failed')),
  total           integer not null,
  succeeded       integer not null default 0,
  failed          integer not null default 0,

  baseline_suite_run_id uuid references public.suite_runs(id) on delete set null,
  trigger         text not null default 'manual' check (trigger in ('manual','auto')),
  source_run_id   uuid references public.runs(id) on delete set null,

  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  finished_at     timestamptz
);

alter table public.evaluations
  add column suite_run_id uuid references public.suite_runs(id) on delete cascade;
```

**The clip list is snapshotted at launch.** `clip_set_id` records which saved set was chosen;
`clip_ids` records what that resolved to at that moment. A saved set is a living thing — someone
adds three night clips next week — and without the snapshot, last month's suite would silently
claim to have covered them. The alternative (resolve at read time) makes every historical result
quietly wrong the first time the set is edited.

**A saved clip set is what makes the library worth having.** "The occlusion suite", re-run
against every new model, is the verb this whole map exists to enable. Ad-hoc selection stays
possible — it just produces a `suite_run` with `clip_set_id = null` and the resolved
`clip_ids` filled in, so it is equally reproducible.

**Model and config are denormalised onto both the suite and each evaluation.** An evaluation
must be self-contained — it can exist with `suite_run_id = null`, produced by the CLI or by a
one-off replay — so it carries its own artifact identity, config and engine version. The suite
holds the same values because it fixes them for its children. This is deliberate duplication of
immutable facts, not a normalisation failure.

**Execution is a claimable queue, and resumability falls out for free.** Launching a suite
writes N `evaluations` rows at `status = 'pending'`. A worker — the Mac, or a Pi for `.hef` —
claims a pending row, sets it `running`, and finishes it `succeeded` or `failed`. Nothing else
is needed for "resume after the machine sleeps": restarting means picking up the rows still
pending. This also means a suite can be worked by more than one machine without any new
infrastructure, which is exactly what [07](./07-portable-hef-runner.md) will need.

**An incomplete suite has no headline. That is the point.** The parent `CLAUDE.md` is
unambiguous that a finalization state which is not clean is not a result. So `status` separates
`complete` (every clip succeeded) from `incomplete` (some failed, run finished) and `failed`
(the suite itself could not run), and **the aggregate number is not rendered at all unless
`status = 'complete'`**. An incomplete suite renders as `12/14 clips · 2 failed` with the
failures reachable in one click. It must be impossible for a partial suite to look like a whole
one — the display rule is the enforcement, and it is written here rather than left to each
screen to remember.

**The headline is total counted versus total expected, with the per-clip distribution beside
it.** These two disagree whenever clip lengths differ, and choosing one silently decides what
everybody optimises for. Totals win the primary slot because that is the number this business
actually steers by — the 380/380 result was a total, not a mean. The per-clip accuracy
distribution sits next to it so a suite that is right on aggregate while being wrong on both
tails cannot hide. When the two measures disagree by more than a threshold, the display says
so rather than picking a winner.

**Comparison is the destination, not a feature.** A suite run may name a
`baseline_suite_run_id`. The comparison view pairs the two suites clip by clip and shows
counted / missed / false and the delta, with a link to the frames where they disagree. Two
rules it enforces rather than assumes:

- **It refuses to compare across different `config_hash` values without saying so.** The
  repo's one-lever discipline is only meaningful if the tool can tell you the lever moved.
- **It refuses to compare across different `artifact_kind` values without saying so.** A `.pt`
  number next to a `.hef` number, unlabelled, is the bug class this map exists to close.

`labApi.ts:276`'s `compareRunManifests` and its `ADDED IDS` / `REMOVED IDS` /
`CHANGED CONFIG KEYS` view already do this shape between two lab manifests. That logic is worth
keeping; what changes is that it now points at two `suite_runs` and the result has somewhere to
live.

**Automation B and C fit without reshaping anything — verified, not assumed:**

- **B, a config matrix**: N suite runs over the same clip set with different configs. It needs
  one nullable `matrix_id` column to group them and nothing else — every suite run already
  carries its own `config` and `config_hash`, which is exactly what a matrix varies.
- **C, firing when training finishes**: `trigger` and `source_run_id` are already in the table
  above, because they cost one column each and adding them later would mean backfilling every
  historical row with a guess. The `training-callback` edge function is the natural place to
  insert the row; nothing about the suite changes.

Neither is built now. B is deferred because a matrix over an engine nobody has trusted yet
multiplies unreliable numbers; C is deferred because firing automatically on a pipeline that is
not yet stable produces results no one believes — and a number nobody believes is worse than no
number, which is the finding that opened this map.
