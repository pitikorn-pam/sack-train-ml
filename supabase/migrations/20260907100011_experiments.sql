-- =============================================================================
-- Migration 11 — experiments: give a run a name, a group, and a declared lever
-- =============================================================================
-- The repo's discipline is "one changed lever per run" and "always compare against
-- a baseline". The system could express neither: `runs` has config_yaml, status,
-- git_sha, hardware and timestamps, and no name, no grouping, no note. Which runs
-- form an ablation lived in somebody's memory, and the comparison happened by
-- opening two browser tabs.
--
-- Two columns and a small table turn that rule from something people remember into
-- something the screen displays. Decided in
--   .scratch/experiment-lab/issues/08-lab-as-umbrella-ia.md
--
-- Deliberately small. `docs/roadmap.md` puts run comparison in Phase 2 gated on a
-- second model line arriving; that sequencing is backwards — comparison is not a
-- scaling feature, it is the core verb of the work being done today.
-- =============================================================================

create table public.experiments (
  id            uuid primary key default gen_random_uuid(),
  model_line_id uuid not null references public.model_lines(id) on delete cascade,
  slug          text not null,
  name          text not null,

  -- Principle 4 of this project: a hypothesis is captured BEFORE the run, and the
  -- verdict after. A grouping id with nowhere to write down what was being asked
  -- would record that an ablation happened without recording what it was for.
  hypothesis    text,
  verdict       text,

  archived      boolean not null default false,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  closed_at     timestamptz,

  unique (model_line_id, slug)
);

comment on table public.experiments is
  'A group of runs that differ by one lever. Carries the hypothesis before, and the verdict after.';
comment on column public.experiments.hypothesis is
  'Written before the first run. A grouping with no hypothesis records that an ablation happened without recording what it was for.';

create index experiments_line_idx on public.experiments (model_line_id, archived, created_at desc);

-- ----------------------------------------------------------------------------
-- runs — a name, the experiment it belongs to, and the lever that moved
-- ----------------------------------------------------------------------------
alter table public.runs
  add column name          text,
  add column experiment_id uuid references public.experiments(id) on delete set null,
  add column changed_lever text;

comment on column public.runs.name is
  'Human label. Until now every run was identified only by a uuid prefix.';
comment on column public.runs.changed_lever is
  'The single parameter this run moved relative to its experiment baseline. Free text on purpose: the lever is sometimes a value, sometimes the dataset, sometimes the checkpoint.';

create index runs_experiment_idx on public.runs (experiment_id, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS — matches migration 06: read for signed-in users, writes admin only
-- ----------------------------------------------------------------------------
alter table public.experiments enable row level security;

create policy experiments_select_authenticated on public.experiments
  for select to authenticated using (true);
create policy experiments_write_admin on public.experiments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.experiments to authenticated;
grant all    on public.experiments to service_role;
