-- =============================================================================
-- Migration 08 — run_profiles + data_assets
-- =============================================================================
-- Two additions that turned out to be the same shape as things already decided
-- (see docs/training-parameter-contract.md and .scratch/train-param-contract/issues/13).
--
-- run_profiles — a named parameter set for a form. Built-in presets are just
--   profiles that ship with the app, seeded at the bottom of this file so they
--   stay reviewable in git. Profiles are IMMUTABLE: editing one inserts a new
--   version rather than mutating the row, because a run recorded as
--   "preset: Balanced" becomes a lie the moment Balanced changes underneath it.
--   A run stores its fully resolved effective config regardless, so the profile
--   name is a convenience label and never the source of truth.
--
-- data_assets — a named, hashed collection of images referenced by key rather
--   than a path. Datasets and calibration sets are the same kind of thing and
--   share this table with a `kind` discriminator: both are uploaded once and
--   reused, and two compiles are only comparable if they can be shown to have
--   used identical images.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- run_profiles
-- ----------------------------------------------------------------------------
create table public.run_profiles (
  id            uuid primary key default gen_random_uuid(),
  model_line_id uuid not null references public.model_lines(id) on delete cascade,
  slug          text not null,
  display_name  text not null,
  description   text,
  form          text not null check (form in ('train', 'compile')),
  -- Tunables only: hyperparameters and compile options. Never the dataset, the
  -- checkpoint or the run name — a profile is "this way of training", applied to
  -- whatever data. Full values, not a delta from the defaults: a delta silently
  -- changes meaning when a default changes.
  values        jsonb not null default '{}'::jsonb,
  version       integer not null default 1,
  builtin       boolean not null default false,
  archived      boolean not null default false,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),

  unique (model_line_id, slug, version)
);

comment on table  public.run_profiles is
  'Named, immutable parameter sets. Editing inserts a new version; built-ins are seeded rows.';
comment on column public.run_profiles.values is
  'Tunables only — hyperparameters or compile options. Excludes dataset, checkpoint and run name.';
comment on column public.run_profiles.version is
  'Immutability mechanism: a profile is never updated in place, so a run citing v1 keeps meaning v1.';
comment on column public.run_profiles.archived is
  'Hides a profile from the picker without deleting it — old runs must stay explainable.';

create index run_profiles_line_form_idx on public.run_profiles (model_line_id, form, archived);

-- ----------------------------------------------------------------------------
-- data_assets
-- ----------------------------------------------------------------------------
create table public.data_assets (
  id            uuid primary key default gen_random_uuid(),
  model_line_id uuid not null references public.model_lines(id) on delete cascade,
  kind          text not null check (kind in ('dataset', 'calibration_set')),
  slug          text not null,
  display_name  text not null,
  description   text,
  -- R2 keys. A dataset points at its data.yaml and (optionally) an image bundle;
  -- a calibration set points at a directory of images.
  manifest_key  text,
  bundle_key    text,
  -- sha256 over the member list, so "did these two compiles use the same images?"
  -- is answerable rather than assumed.
  content_hash  text,
  -- kind-specific counts: {total, train, val, classes} for a dataset,
  -- {images} for a calibration set.
  stats         jsonb not null default '{}'::jsonb,
  archived      boolean not null default false,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),

  unique (model_line_id, kind, slug)
);

comment on table  public.data_assets is
  'Named, hashed image collections referenced by key. Uploaded once, reused across runs.';
comment on column public.data_assets.content_hash is
  'sha256 over the member list — makes "the same calibration images" provable rather than assumed.';

create index data_assets_line_kind_idx on public.data_assets (model_line_id, kind, archived);

-- ----------------------------------------------------------------------------
-- RLS — matches migration 06: read for signed-in users, writes admin only
-- ----------------------------------------------------------------------------
alter table public.run_profiles enable row level security;
alter table public.data_assets  enable row level security;

create policy run_profiles_select_authenticated on public.run_profiles
  for select to authenticated using (true);
create policy run_profiles_write_admin on public.run_profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy data_assets_select_authenticated on public.data_assets
  for select to authenticated using (true);
create policy data_assets_write_admin on public.data_assets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.run_profiles, public.data_assets to authenticated;
grant all    on public.run_profiles, public.data_assets to service_role;

-- ----------------------------------------------------------------------------
-- Seed — the built-in training presets
-- ----------------------------------------------------------------------------
-- Values are full parameter sets, deliberately not deltas. `optimizer` is pinned
-- in every one of them: leaving it out is what let ultralytics' "auto" select an
-- experimental optimizer that crashed a run at epoch 1.
insert into public.run_profiles (model_line_id, slug, display_name, description, form, values, builtin)
select ml.id, p.slug, p.display_name, p.description, 'train', p.values, true
from public.model_lines ml
cross join (values
  ('quick-test', 'Quick test',
   'A short run to prove the pipeline end to end, not to produce a deployable model.',
   '{"epochs":25,"imgsz":640,"batch":"auto","optimizer":"AdamW","lr0":0.001,"patience":10,
     "seed":0,"deterministic":true,"save_period":25,"close_mosaic":5,"fraction":0.25,"freeze":null}'::jsonb),
  ('balanced', 'Balanced',
   'The default starting point for a fine-tune from a pretrained checkpoint.',
   '{"epochs":100,"imgsz":640,"batch":"auto","optimizer":"AdamW","lr0":0.001,"patience":20,
     "seed":0,"deterministic":true,"save_period":25,"close_mosaic":10,"fraction":1.0,"freeze":null}'::jsonb),
  ('full-training', 'Full training',
   'A long run for a model intended to ship. Expect to babysit the Colab session.',
   '{"epochs":300,"imgsz":640,"batch":"auto","optimizer":"AdamW","lr0":0.001,"patience":50,
     "seed":0,"deterministic":true,"save_period":25,"close_mosaic":10,"fraction":1.0,"freeze":null}'::jsonb)
) as p(slug, display_name, description, values)
on conflict do nothing;
