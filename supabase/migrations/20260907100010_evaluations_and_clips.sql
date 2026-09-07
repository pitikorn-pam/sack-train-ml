-- =============================================================================
-- Migration 10 — the Experiment Lab: clips, ground truth, suites, evaluations
-- =============================================================================
-- The registry records how training WENT. It has never recorded how a model
-- PERFORMED. run_metrics is (run_id, step, name, value) with that as its primary
-- key, so it holds training curves and structurally cannot hold a second
-- measurement of the same model, let alone say what footage it was measured on.
--
-- The number this team steers by — counted vs ground truth on real footage — has
-- had nowhere to live. This migration gives it one.
--
-- Decisions and their reasoning:
--   .scratch/experiment-lab/issues/02-what-is-one-evaluation.md
--   .scratch/experiment-lab/issues/03-what-is-a-scenario-clip.md
--   .scratch/experiment-lab/issues/06-what-is-a-suite-run.md
--
-- Two guardrails are expressed as CHECK constraints rather than as conventions,
-- because the parent CLAUDE.md records that in nine of nine sessions a written
-- reminder failed to prevent the error it described, and only a mechanical gate
-- ever did:
--   * evaluations.reportable cannot be true without real provenance;
--   * clips.frame_count cannot be inserted unless a real ffprobe produced it.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- scenarios — a controlled vocabulary, in a table rather than an enum
-- ----------------------------------------------------------------------------
-- Free tags were rejected: the library's whole value is asking "how does this
-- model do on the occlusion clips", which free tags answer only by luck once
-- somebody has typed occlusion, occluded and occlussion. An enum was rejected
-- too — a new situation would need a migration. A table gets both.
create table public.scenarios (
  slug        text primary key,
  label       text not null,
  description text not null,
  sort_order  integer not null default 100
);

comment on table public.scenarios is
  'Controlled vocabulary for clip situations. Adding one is an insert, not a migration.';

insert into public.scenarios (slug, label, description, sort_order) values
  ('clean-baseline',     'Clean baseline',     'Unobstructed, well-lit, ordinary throughput. A library of only hard clips cannot tell you that a change broke the easy case.', 10),
  ('occlusion',          'Occlusion',          'A sack is hidden, wholly or partly, by a person, a stack, or structure.', 20),
  ('stacked',            'Stacked',            'Sacks carried or moved several at a time, where one crossing is not one object.', 30),
  ('carried',            'Carried',            'A sack carried by a worker rather than moving on its own path.', 40),
  ('adjacent-container', 'Adjacent container', 'A second container in frame whose traffic can be miscounted into this one.', 50),
  ('low-light',          'Low light',          'Dusk, night, or a poorly lit bay.', 60),
  ('weather',            'Weather',            'Rain, glare, or anything that degrades the image without hiding the object.', 70),
  ('fast-throughput',    'Fast throughput',    'Crossings close enough together to stress dedup and cooldown.', 80),
  ('person-crossing',    'Person crossing',    'A worker crosses the counting line without a sack.', 90),
  ('camera-shift',       'Camera shift',       'The camera moves mid-clip, so a line fitted at the start stops being true.', 100);

-- ----------------------------------------------------------------------------
-- clips — footage with geometry and, when someone has established it, truth
-- ----------------------------------------------------------------------------
-- Deliberately NOT a data_assets row. data_assets answers "are these the same
-- bytes" for datasets and calibration sets. A clip is asked different questions —
-- where is the line, what is the truth, how many frames are there really — and
-- those are columns, not a jsonb bag behind a discriminator. evaluations.clip_id
-- also needs a real foreign key to point at.
--
-- Deliberately NOT scoped to a model_line either: footage is footage, and the
-- same clip is exactly what makes two model lines comparable.
create table public.clips (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,

  -- The bytes.
  r2_key            text not null,
  sha256            text not null unique,
  bytes             bigint not null check (bytes > 0),

  -- Measured, never assumed. `probe` holds the raw ffprobe output these came from.
  fps               numeric not null check (fps > 0),
  frame_count       integer not null check (frame_count > 0),
  width             integer not null check (width > 0),
  height            integer not null check (height > 0),
  probe             jsonb   not null,

  -- Geometry: where counting happens in this clip.
  line              jsonb,
  inflip            boolean not null default false,
  exclusion_zones   jsonb   not null default '[]'::jsonb,

  -- Truth.
  gt_kind           text not null default 'none'
                      check (gt_kind in ('none', 'count', 'per_crossing')),
  expected_count    integer check (expected_count is null or expected_count >= 0),
  gt_ref            text,
  gt_source         text,
  gt_established_at timestamptz,
  gt_established_by uuid references auth.users(id) on delete set null,

  -- Where the clip itself came from.
  provenance        jsonb not null,
  source_clip_id    uuid references public.clips(id) on delete set null,
  trim_start_frame  integer check (trim_start_frame is null or trim_start_frame >= 0),
  trim_end_frame    integer,

  notes             text,
  archived          boolean not null default false,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),

  -- GUARDRAIL. duration x r_frame_rate lies, and has already cost this project a
  -- wrong count. The established method is `ffprobe -count_packets` with
  -- avg_frame_rate, and rather than trust the ingest tool to have used it, the raw
  -- probe is stored and its packet count is required to be present. A row whose
  -- frame count was guessed cannot be inserted at all.
  -- Same NULL-passes-CHECK trap as above: jsonb_exists returns a real boolean rather
  -- than NULL for a missing key, so this one is already tight. Kept explicit so the
  -- next person does not "simplify" it into `probe ? 'nb_read_packets'` and lose that.
  constraint clips_frame_count_is_measured
    check (jsonb_exists(probe, 'nb_read_packets') is true),

  -- Each kind of truth carries its own obligations.
  constraint clips_gt_count_needs_a_number
    check (gt_kind <> 'count' or expected_count is not null),
  constraint clips_gt_per_crossing_needs_both
    check (gt_kind <> 'per_crossing' or (expected_count is not null and gt_ref is not null)),

  constraint clips_trim_range_is_ordered
    check (trim_end_frame is null or trim_start_frame is null or trim_end_frame > trim_start_frame)
);

comment on table  public.clips is
  'Footage the Lab measures against. One row per video file, identified by sha256.';
comment on column public.clips.probe is
  'Raw ffprobe output. The source of fps/frame_count, and the evidence they were measured rather than derived from a nominal frame rate.';
comment on column public.clips.gt_kind is
  'none = replayable but produces no verdict. count = a person established the total. per_crossing = cv-review produced frame-level truth, which additionally enables missed/false_positive.';
comment on column public.clips.source_clip_id is
  'Set when this clip was trimmed from a longer one, so two trims of the same footage are visibly related rather than looking like independent evidence.';

create index clips_archived_idx    on public.clips (archived, created_at desc);
create index clips_gt_kind_idx     on public.clips (gt_kind) where archived = false;
create index clips_source_clip_idx on public.clips (source_clip_id);

create table public.clip_scenarios (
  clip_id  uuid not null references public.clips(id)         on delete cascade,
  scenario text not null references public.scenarios(slug)   on delete restrict,
  primary key (clip_id, scenario)
);

create index clip_scenarios_scenario_idx on public.clip_scenarios (scenario);

-- ----------------------------------------------------------------------------
-- clip_sets — "the occlusion suite", re-runnable against every new model
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- suite_runs — one model over a set of clips
-- ----------------------------------------------------------------------------
create table public.suite_runs (
  id              uuid primary key default gen_random_uuid(),
  name            text,

  -- WHICH model. Same identity an evaluation carries, fixed for the whole suite.
  version_id      uuid references public.versions(id) on delete set null,
  run_id          uuid references public.runs(id)     on delete set null,
  artifact_kind   text not null check (artifact_kind in ('pt', 'hef', 'onnx')),
  artifact_ref    text not null,
  artifact_sha256 text not null,

  -- WHAT it ran over. clip_set_id is provenance; clip_ids is the resolved list,
  -- snapshotted at launch. A saved set is a living thing — someone adds three
  -- night clips next week — and without the snapshot, last month's suite would
  -- silently claim to have covered them.
  clip_set_id     uuid references public.clip_sets(id) on delete set null,
  clip_ids        uuid[] not null check (cardinality(clip_ids) > 0),

  -- HOW it counted.
  engine_version  text  not null,
  config          jsonb not null,
  config_hash     text  not null,

  -- Progress. Stored so the UI need not aggregate to render a list.
  status          text not null default 'pending'
                    check (status in ('pending', 'running', 'complete', 'incomplete', 'failed')),
  total           integer not null check (total > 0),
  succeeded       integer not null default 0 check (succeeded >= 0),
  failed          integer not null default 0 check (failed >= 0),

  baseline_suite_run_id uuid references public.suite_runs(id) on delete set null,

  -- Automation seams. Present from the start because they cost one column each and
  -- adding them later would mean backfilling every historical row with a guess.
  trigger         text not null default 'manual' check (trigger in ('manual', 'auto')),
  source_run_id   uuid references public.runs(id) on delete set null,

  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  finished_at     timestamptz,

  constraint suite_runs_counts_fit_total check (succeeded + failed <= total),
  -- A suite is only 'complete' when every clip succeeded. This is what makes it
  -- impossible for a partial suite to render an aggregate number: the UI gates on
  -- status = 'complete', and the database refuses to let that mean anything else.
  constraint suite_runs_complete_means_complete
    check (status <> 'complete' or (succeeded = total and failed = 0))
);

comment on table  public.suite_runs is
  'One model artifact measured over a snapshotted list of clips with one counting config.';
comment on column public.suite_runs.clip_ids is
  'The resolved clip list at launch. Snapshotted so that editing the saved set later cannot rewrite history.';
comment on constraint suite_runs_complete_means_complete on public.suite_runs is
  'An unclean finalization state is not a result. The aggregate readout is gated on status = complete, so this constraint is what stops a partial suite from ever looking like a whole one.';

create index suite_runs_version_idx  on public.suite_runs (version_id, created_at desc);
create index suite_runs_status_idx   on public.suite_runs (status, created_at desc);
create index suite_runs_baseline_idx on public.suite_runs (baseline_suite_run_id);

-- ----------------------------------------------------------------------------
-- evaluations — (artifact bytes) x (clip, over a frame range) x (config)
-- ----------------------------------------------------------------------------
-- Append-only. Re-running an identical config over an identical clip writes a NEW
-- row: Principle 1 says nothing is deleted, and a repeat that returns a different
-- number is the only way non-determinism ever becomes visible. Upserting on
-- (artifact, clip, config) was rejected because it destroys exactly the evidence
-- that would expose a flaky engine.
create table public.evaluations (
  id                uuid primary key default gen_random_uuid(),
  suite_run_id      uuid references public.suite_runs(id) on delete cascade,

  -- WHICH model. Identified by its bytes, not by a pointer that can be repointed —
  -- measuring a different artifact than the one deployed is this project's
  -- recurring bug. version_id and run_id are both nullable because the Lab already
  -- supports models that came from neither, and a measurement of an unregistered
  -- model is still real; it just cannot be promoted.
  version_id        uuid references public.versions(id) on delete set null,
  run_id            uuid references public.runs(id)     on delete set null,
  artifact_kind     text not null check (artifact_kind in ('pt', 'hef', 'onnx')),
  artifact_ref      text not null,
  artifact_sha256   text not null,

  -- WHAT it was measured on.
  clip_id           uuid not null references public.clips(id) on delete restrict,
  frame_start       integer not null default 0 check (frame_start >= 0),
  frame_end         integer,
  frame_stride      integer not null default 1 check (frame_stride >= 1),
  -- Stored, not inferred. The Lab has frame start/end/stride controls, so a partial
  -- run is easy to produce and easy to mistake for a full one; deriving this at read
  -- time would go wrong the moment a clip's frame count is corrected.
  whole_clip        boolean not null,

  -- HOW it was counted. engine_version is not optional: one shared engine still
  -- changes between releases, and a count that moved because the engine moved is
  -- otherwise indistinguishable from one that moved because the model did.
  engine_version    text  not null,
  config            jsonb not null,
  config_hash       text  not null,

  -- THE NUMBERS. counted/expected are flat columns because every comparison query
  -- reads them and they must not depend on two writers agreeing on a jsonb key.
  -- missed/false_positive are nullable because they are only derivable when the
  -- clip carries per-crossing truth, and a count-only clip is first-class.
  counted           integer check (counted is null or counted >= 0),
  expected          integer check (expected is null or expected >= 0),
  missed            integer check (missed is null or missed >= 0),
  false_positive    integer check (false_positive is null or false_positive >= 0),
  metrics           jsonb not null default '{}'::jsonb,

  -- WHETHER IT MAY BE REPORTED.
  provenance        jsonb not null,
  reportable        boolean not null default false,

  -- WHO, WHERE, AND HOW IT ENDED.
  status            text not null default 'pending'
                      check (status in ('pending', 'running', 'succeeded', 'failed')),
  error             text,
  runner            text not null check (runner in ('lab-web', 'lab-cli', 'device')),
  runner_host       text,
  artifact_overlay_key text,
  verdict           text check (verdict in ('pass', 'fail', 'inconclusive')),
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz,

  constraint evaluations_numbers_present_when_succeeded
    check (status <> 'succeeded' or (counted is not null and expected is not null)),

  constraint evaluations_frame_range_is_ordered
    check (frame_end is null or frame_end > frame_start),

  -- GUARDRAIL. _cv_lib/provenance.py::assert_reportable already fails closed on an
  -- assembled or unknown source, an assumed rather than measured fps, and a
  -- hand-typed count. That rule has to survive three producers — a web app, a CLI
  -- and a Pi — so it lives here, where all three pass through, rather than in three
  -- copies of a convention. reportable defaults to false: a row that says nothing
  -- about where it came from cannot claim to be reportable.
  -- Written with coalesce and text comparison on purpose, and it matters. A CHECK
  -- constraint PASSES when its expression evaluates to NULL, not just when it is true.
  -- `provenance ->> 'fps_measured'` returns SQL NULL when the key holds a JSON null, so
  -- `(... )::boolean` would yield NULL and the whole conjunction would be NULL — and the
  -- row would be admitted. A cast would also raise on any value that is not a boolean
  -- literal, turning a lie into a confusing 500 instead of a clean refusal. Comparing
  -- coalesced text against the exact string the jsonb representation produces closes both.
  constraint evaluations_reportable_requires_provenance check (
    reportable = false or (
          coalesce(provenance ->> 'source_kind', '') in ('registered_session', 'original_capture')
      and coalesce(provenance ->> 'fps_measured', '') = 'true'
      and coalesce(provenance ->> 'count_origin', '') = 'machine'
    )
  )
);

comment on table  public.evaluations is
  'One measurement: (model artifact bytes) x (clip, over a stated frame range) x (resolved counting config) -> numbers. Append-only.';
comment on column public.evaluations.artifact_sha256 is
  'The identity that matters. A pointer can be repointed; measuring a different artifact than the one deployed is this project''s recurring bug.';
comment on column public.evaluations.artifact_kind is
  'pt or hef. Present from day one so a .pt number and a .hef number can never be compared unlabelled.';
comment on column public.evaluations.engine_version is
  'The shared counting engine. Without it, a count that moved with the engine is indistinguishable from one that moved with the model.';
comment on constraint evaluations_reportable_requires_provenance on public.evaluations is
  'The provenance gate, mechanical. A guardrail in the schema rather than a reminder in a README — the parent CLAUDE.md records that only the former has ever worked.';

create index evaluations_suite_idx    on public.evaluations (suite_run_id);
create index evaluations_clip_idx     on public.evaluations (clip_id, created_at desc);
create index evaluations_version_idx  on public.evaluations (version_id, created_at desc);
create index evaluations_status_idx   on public.evaluations (status) where status in ('pending', 'running');
create index evaluations_compare_idx  on public.evaluations (clip_id, config_hash, artifact_kind);

-- ----------------------------------------------------------------------------
-- RLS — matches migration 06: read for signed-in users, writes admin only
-- ----------------------------------------------------------------------------
alter table public.scenarios        enable row level security;
alter table public.clips            enable row level security;
alter table public.clip_scenarios   enable row level security;
alter table public.clip_sets        enable row level security;
alter table public.clip_set_members enable row level security;
alter table public.suite_runs       enable row level security;
alter table public.evaluations      enable row level security;

create policy scenarios_select_authenticated        on public.scenarios        for select to authenticated using (true);
create policy scenarios_write_admin                 on public.scenarios        for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy clips_select_authenticated            on public.clips            for select to authenticated using (true);
create policy clips_write_admin                     on public.clips            for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy clip_scenarios_select_authenticated   on public.clip_scenarios   for select to authenticated using (true);
create policy clip_scenarios_write_admin            on public.clip_scenarios   for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy clip_sets_select_authenticated        on public.clip_sets        for select to authenticated using (true);
create policy clip_sets_write_admin                 on public.clip_sets        for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy clip_set_members_select_authenticated on public.clip_set_members for select to authenticated using (true);
create policy clip_set_members_write_admin          on public.clip_set_members for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy suite_runs_select_authenticated       on public.suite_runs       for select to authenticated using (true);
create policy suite_runs_write_admin                on public.suite_runs       for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy evaluations_select_authenticated      on public.evaluations      for select to authenticated using (true);
create policy evaluations_write_admin               on public.evaluations      for all    to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on
  public.scenarios, public.clips, public.clip_scenarios,
  public.clip_sets, public.clip_set_members,
  public.suite_runs, public.evaluations
to authenticated;

grant all on
  public.scenarios, public.clips, public.clip_scenarios,
  public.clip_sets, public.clip_set_members,
  public.suite_runs, public.evaluations
to service_role;
