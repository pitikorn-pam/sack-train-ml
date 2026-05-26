-- =============================================================================
-- Migration 05 — channel_deployments
-- =============================================================================
-- Higher-fidelity deployment tracking than `channels`. Each row = one version
-- explicitly published to a channel, with active/archived state and an
-- is_default flag (the version that runtime should serve when no specific
-- compat_signature is requested).
--
-- channels still works for simple "latest pointer" queries; channel_deployments
-- gives us history + rollback + multiple compat-signatures on one channel.
--
-- NOTE: channel name is free-form text (no CHECK constraint), unlike seed-ml
-- which hardcoded staging/production. Phase 2 may introduce per-project
-- channel sets — keep it open.
-- =============================================================================

create table public.channel_deployments (
  id              uuid primary key default gen_random_uuid(),
  model_line_id   uuid not null references public.model_lines(id) on delete restrict,
  channel_name    text not null,
  version_id      uuid not null references public.versions(id) on delete restrict,
  status          text not null default 'active'
                  check (status in ('active','archived')),
  is_default      boolean not null default false,
  deployed_at     timestamptz not null default now(),
  deployed_by     uuid,  -- auth.uid() when available
  notes           text
);

create index channel_deployments_lookup_idx
  on public.channel_deployments (model_line_id, channel_name, status, is_default);

create index channel_deployments_version_idx
  on public.channel_deployments (version_id);

-- Only one default per (model_line, channel) when status=active
create unique index channel_deployments_one_default
  on public.channel_deployments (model_line_id, channel_name)
  where (status = 'active' and is_default = true);

comment on table public.channel_deployments is
  'Per-version deployment records. Tracks active/archived state, default flag, and history. Channel name is free-form.';
