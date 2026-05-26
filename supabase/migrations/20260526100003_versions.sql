-- =============================================================================
-- Migration 03 — versions
-- =============================================================================
-- Immutable artifact versions produced by a successful run.
--
-- DESIGN NOTE (vs seed-ml):
--   seed-ml has 3 typed columns: tflite_r2_key, mlmodel_r2_key, pytorch_r2_key.
--   We use a single `artifacts jsonb` column (Decision D2/B) so future projects
--   can ship any artifact set without schema migrations. Shape:
--
--     artifacts = {
--       "pytorch":  { "key": "...", "size_bytes": 123, "sha256": "...", "quantization": {...} },
--       "onnx":     { "key": "...", "size_bytes": 123, "sha256": "..." },
--       "hef":      { "key": "...", "size_bytes": 123, "sha256": "...", "quantization": {...} },
--       "hef_meta": { "key": "...", "size_bytes": 123, "sha256": "..." }
--     }
--
-- compat_signature is computed from class_names + input_size + output_kind + task
-- so the runtime can detect breaking changes between versions on the same channel.
-- =============================================================================

create table public.versions (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references public.runs(id) on delete restrict,
  model_line_id     uuid not null references public.model_lines(id) on delete restrict,
  semver            text not null,
  compat_signature  text not null,
  artifacts         jsonb not null default '{}'::jsonb,
  metadata          jsonb not null default '{}'::jsonb,
  size_bytes        bigint,
  content_hash      text,
  created_at        timestamptz not null default now(),
  unique (model_line_id, semver)
);

create index versions_run_id_idx        on public.versions (run_id);
create index versions_model_line_idx    on public.versions (model_line_id);
create index versions_compat_idx        on public.versions (compat_signature);
create index versions_created_at_idx    on public.versions (created_at desc);

comment on table  public.versions is
  'Immutable artifact set produced by a successful run. artifacts JSONB is the storage-key registry; metadata JSONB carries everything else (class_names, input_size, hyperparams, metrics_summary, hef_compile_flags, ...).';
comment on column public.versions.artifacts is
  'JSONB map of artifact_kind → { key, size_bytes, sha256, quantization?, packaging? }.';
comment on column public.versions.metadata is
  'JSONB. Required keys: class_names (string[]), input_size ([h,w] or [h,w,c]), output_kind (string), task (string). Optional: hyperparameters, metrics_summary, export_options, export_git_sha, edge_exports.';
comment on column public.versions.compat_signature is
  'SHA256 of canonical-JSON of (class_names, input_size, output_kind, task). Used by runtime to detect breaking changes.';

-- ----------------------------------------------------------------------------
-- compute_compat_signature: SHA256 of canonical metadata subset
-- ----------------------------------------------------------------------------
create or replace function public.compute_compat_signature(meta jsonb)
returns text
language plpgsql
immutable
as $$
declare
  canonical jsonb;
begin
  canonical := jsonb_build_object(
    'class_names', coalesce(meta->'class_names', '[]'::jsonb),
    'input_size',  coalesce(meta->'input_size',  '[]'::jsonb),
    'output_kind', coalesce(meta->>'output_kind', ''),
    'task',        coalesce(meta->>'task',        '')
  );
  return encode(sha256(canonical::text::bytea), 'hex');
end;
$$;

-- Trigger: auto-fill compat_signature on insert/update
create or replace function public.versions_set_compat_signature()
returns trigger
language plpgsql
as $$
begin
  new.compat_signature := public.compute_compat_signature(new.metadata);
  return new;
end;
$$;

create trigger versions_set_compat_signature
  before insert or update of metadata on public.versions
  for each row execute function public.versions_set_compat_signature();
