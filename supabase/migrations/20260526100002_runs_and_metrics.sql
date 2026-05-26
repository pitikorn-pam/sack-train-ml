-- =============================================================================
-- Migration 02 — runs + run_metrics
-- =============================================================================
-- runs: a single training job. Carries config_yaml (dataset, hyperparams,
--   export options, log array), status lifecycle, hardware fingerprint,
--   git_sha of the code that ran, and provider_job_id for external job
--   tracking (Colab session id, CI run id, etc).
--
-- run_metrics: per-step training metrics streamed live from the notebook
--   (mAP50, precision, recall, loss, progress). One row per (run, step, name).
-- =============================================================================

create table public.runs (
  id              uuid primary key default gen_random_uuid(),
  model_line_id   uuid not null references public.model_lines(id) on delete restrict,
  status          text not null default 'pending'
                  check (status in ('pending','running','succeeded','failed','cancelled')),
  config_yaml     jsonb not null default '{}'::jsonb,
  hardware        jsonb,
  git_sha         text,
  provider_job_id text,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index runs_model_line_idx       on public.runs (model_line_id);
create index runs_status_idx           on public.runs (status);
create index runs_created_at_idx       on public.runs (created_at desc);
create index runs_provider_job_id_idx  on public.runs (provider_job_id);

create trigger runs_set_updated_at
  before update on public.runs
  for each row execute function public.set_updated_at();

comment on table  public.runs is
  'One training job. config_yaml holds dataset/hyperparams/export options/log array.';
comment on column public.runs.config_yaml is
  'JSONB. Keys: dataset, source_weights, classes, hyperparameters, export_options, dataset_stats, dataset_bundle, logs.';
comment on column public.runs.hardware is
  'JSONB snapshot: { gpu, cpu, ram_gb, platform, python_version, ... }.';
comment on column public.runs.provider_job_id is
  'External job tracker — Colab session id, GitHub Actions run, etc.';

-- run_metrics: per-epoch streamed metrics
create table public.run_metrics (
  run_id  uuid    not null references public.runs(id) on delete cascade,
  step    integer not null,
  epoch   integer,
  name    text    not null,
  value   double precision not null,
  ts      timestamptz not null default now(),
  primary key (run_id, step, name)
);

create index run_metrics_run_id_idx on public.run_metrics (run_id);
create index run_metrics_name_idx   on public.run_metrics (name);

comment on table public.run_metrics is
  'Streamed training metrics per epoch. Examples of `name`: map50, precision, recall, box_loss, progress.';
