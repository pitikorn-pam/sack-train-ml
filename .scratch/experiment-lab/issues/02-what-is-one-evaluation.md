# 02 — What is one `evaluations` row?

Type: grilling
Status: resolved
Blocked by: —

## Question

The registry records how training *went*, never how the model *performed*. `run_metrics` is
`(run_id, step, name, value)` with that as its primary key
(`20260526100002_runs_and_metrics.sql`) — training curves only. It has no notion of footage,
no artifact link, and structurally **cannot hold a second measurement** of the same model,
because one value per name per step is all the key allows.

The number this team steers by — counted versus ground truth on real footage — has nowhere
to live. Decide the record that gives it one.

An evaluation is *(model artifact) × (clip) → (numbers, verdict)*. Settle:

- **Identity.** What makes two evaluations the same measurement versus two measurements?
  Re-running an identical config over an identical clip: new row, or replace?
- **What names the model.** `run_id`, `version_id`, `artifact_kind` (`pt` / `hef`) — and
  what happens for a model that was uploaded rather than trained here, which the Lab
  already supports (`Lab.tsx:572` offers registry / legacy / local model modes).
- **What names the footage.** A reference to the clip record from
  [03](./03-what-is-a-scenario-clip.md), plus the frame range actually processed — the Lab
  already has frame start / end / stride controls, so a partial run must not masquerade as
  a whole-clip result.
- **What numbers.** Counted, expected, missed, false, and the derived accuracy — flat
  columns, or `metrics jsonb`? Weigh: jsonb survives new metrics without a migration; flat
  columns can be queried and compared without agreeing on key names first.
- **The config that produced it.** The whole resolved counting config, or a hash plus a
  pointer? Two evaluations are only comparable if their configs can be shown to differ in
  exactly one place — the repo's "one changed lever per run" rule needs this to be
  mechanical, not remembered.
- **The verdict.** Free text, an enum, or absent — and who or what writes it.
- **Provenance, mandatory.** The parent `CLAUDE.md` provenance gate refuses to report a
  count whose source is assembled or whose fps was assumed. An `evaluations` row is exactly
  a reported count, so the gate has to be expressible in the record itself, not applied by
  convention afterwards.

The test this decision must pass: *"is this model better than the one deployed, on the
footage we care about"* should be one query, and the answer should carry the label saying
which artifact each side of the comparison was.

## Answer

*(Taken on the recommendations, under the owner's directive to keep moving; every choice
below names its alternative so it can be overturned without re-deriving it.)*

One table, append-only. An evaluation is **(the bytes of one model artifact) × (one clip,
over a stated frame range) × (one resolved counting config) → numbers, with a verdict.**

```sql
create table public.evaluations (
  id                uuid primary key default gen_random_uuid(),

  -- WHICH model. The artifact is identified by its bytes, not by a pointer.
  version_id        uuid references public.versions(id) on delete set null,
  run_id            uuid references public.runs(id)     on delete set null,
  artifact_kind     text not null check (artifact_kind in ('pt','hef','onnx')),
  artifact_ref      text not null,           -- R2 key, or a stable local identity
  artifact_sha256   text not null,

  -- WHAT it was measured on.
  clip_id           uuid not null references public.clips(id) on delete restrict,
  frame_start       integer not null default 0,
  frame_end         integer,                 -- null = to the end of the clip
  frame_stride      integer not null default 1,
  whole_clip        boolean not null,        -- computed by the writer, stored, never inferred

  -- HOW it was counted.
  engine_version    text not null,           -- the shared counting engine's version
  config            jsonb not null,          -- the fully resolved counting config
  config_hash       text not null,           -- stable hash of `config`

  -- THE NUMBERS.
  counted           integer,
  expected          integer,
  missed            integer,                 -- null unless the clip has per-crossing GT
  false_positive    integer,                 -- null unless the clip has per-crossing GT
  metrics           jsonb not null default '{}'::jsonb,

  -- WHETHER IT MAY BE REPORTED.
  provenance        jsonb not null,
  reportable        boolean not null default false,

  -- WHO, WHERE, AND HOW IT ENDED.
  status            text not null default 'pending'
                      check (status in ('pending','running','succeeded','failed')),
  error             text,
  runner            text not null check (runner in ('lab-web','lab-cli','device')),
  runner_host       text,                    -- e.g. the Mac's name, or edge003
  verdict           text check (verdict in ('pass','fail','inconclusive')),
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),

  constraint numbers_present_when_succeeded
    check (status <> 'succeeded' or (counted is not null and expected is not null))
);
```

**Identity — append-only, never replace.** Re-running an identical config over an identical
clip writes a **new row**. Two reasons, and the second is the real one: Principle 1 says
nothing is deleted, and a repeat that returns a *different* number is the only way
non-determinism ever becomes visible. `config_hash` + `artifact_sha256` + `clip_id` group
repeats without collapsing them. The alternative — upsert on that triple — was rejected
because it silently destroys exactly the evidence that would expose a flaky engine.

**What names the model: the bytes.** `artifact_sha256` is mandatory and `artifact_ref` is
recorded alongside it, because a pointer can be repointed and this project's recurring bug
is measuring a different artifact than the one deployed. `version_id` and `run_id` are both
nullable: the Lab already supports models that came from neither (`Lab.tsx:572` offers
registry / legacy / local modes), and a measurement of an unregistered model is still a
real measurement — it just cannot be promoted.

**`artifact_kind` from day one**, even though `.pt` is the only path being built now. It
costs one column and it is the label that stops a `.pt` number and a `.hef` number from ever
being compared unlabelled — the bug class this whole map exists to close.

**`engine_version` is not optional.** One shared counting engine still changes between
releases, and a count that moved because the engine moved is indistinguishable from a count
that moved because the model moved unless this column exists. It is the invisible lever, so
it gets a visible column.

**Numbers: four flat columns plus jsonb, deliberately hybrid.** `counted` and `expected` are
always present on success and are what every comparison query reads — putting them in jsonb
would make the central question depend on two writers having agreed on a key name. `missed`
and `false_positive` are nullable because they are only derivable when the clip carries
per-crossing ground truth, and a clip with only a total count is a first-class citizen (see
[03](./03-what-is-a-scenario-clip.md)). Everything else — per-class breakdowns, timings,
confidence distributions — goes in `metrics` so a new measurement never needs a migration.

**`whole_clip` is stored, not inferred.** The Lab has frame start / end / stride controls,
so a partial run is easy to produce and easy to mistake for a full one. Deriving it at read
time from `frame_end is null` would be wrong the moment a clip's frame count is corrected.

**Config: the resolved blob and its hash, both.** The hash makes "these two differ in
exactly one place" a mechanical check rather than a remembered rule — the repo's one-lever
discipline needs that, and a diff of the two blobs names the lever. Storing only the hash
would make a row unreadable once the config's shape changes.

**Provenance is a structural gate, not a convention.** `_cv_lib/provenance.py::assert_reportable`
already fails closed on an assembled or unknown source, an assumed rather than measured fps,
and a hand-typed count line. That rule has to survive three producers — a web app, a CLI,
and a Pi — so it belongs in the table:

```sql
alter table public.evaluations add constraint reportable_requires_provenance check (
  reportable = false or (
        provenance ? 'source_kind' and provenance->>'source_kind' in ('registered_session','original_capture')
    and provenance ? 'fps_measured'  and (provenance->>'fps_measured')::boolean
    and provenance ? 'count_origin'  and provenance->>'count_origin' = 'machine'
  )
);
```

`reportable` defaults to **false**. A row that says nothing about where it came from cannot
claim to be reportable, and no amount of prose in a README can be forgotten into it. The
parent `CLAUDE.md` is explicit that the only thing that has ever prevented this class of
error is a guardrail in the pipeline rather than another reminder; this is that guardrail,
expressed once, where all three producers pass through.

**`status` and `error` exist because a suite needs them.** "12 of 14 clips done, 1 failed"
is unrepresentable without them, and the parent `CLAUDE.md` is unambiguous that an unclean
finalization state is not a result — so the schema has to be able to say *failed* rather
than quietly holding a row with null numbers.

**Grouping is deliberately absent.** A `suite_run_id` belongs to
[06](./06-what-is-a-suite-run.md), which is blocked on this ticket; adding it now would be
guessing at that answer. It arrives later as one nullable FK, which reshapes nothing.

### What this makes possible in one query

> Is the candidate better than what is deployed, on the clips we care about?

```sql
select c.name, c.scenario,
       b.counted as baseline, n.counted as candidate, c.expected_count as gt,
       b.artifact_kind as baseline_artifact, n.artifact_kind as candidate_artifact
from evaluations b
join evaluations n on n.clip_id = b.clip_id and n.config_hash = b.config_hash
join clips c       on c.id = b.clip_id
where b.version_id = :deployed and n.version_id = :candidate
  and b.status = 'succeeded' and n.status = 'succeeded'
  and b.reportable and n.reportable;
```

The join on `config_hash` is the point: it refuses to compare two runs that were not counted
the same way, and the artifact kind travels with each side so the answer can never be read
without knowing what produced it.
