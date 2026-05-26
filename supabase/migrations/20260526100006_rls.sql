-- =============================================================================
-- Migration 06 — RLS policies + role helpers + grants
-- =============================================================================
-- Three roles in play:
--   anon            — public web (read-only on metadata)
--   authenticated   — signed-in users (read runs + metrics)
--   admin           — JWT app_metadata.role = 'admin', full write
--   service_role    — backend / edge functions, bypasses RLS via service-role JWT
--
-- Pattern (from seed-ml):
--   - Public-safe tables (model_lines, versions, channels, channel_history,
--     channel_deployments) → SELECT for anyone
--   - Sensitive tables (runs, run_metrics) → SELECT for authenticated only
--   - All writes → admin only (service_role bypasses RLS anyway)
-- =============================================================================

-- Enable RLS on all tables
alter table public.model_lines          enable row level security;
alter table public.runs                 enable row level security;
alter table public.run_metrics          enable row level security;
alter table public.versions             enable row level security;
alter table public.channels             enable row level security;
alter table public.channel_history      enable row level security;
alter table public.channel_deployments  enable row level security;

-- ----------------------------------------------------------------------------
-- is_admin() helper — checks JWT app_metadata.role
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- ----------------------------------------------------------------------------
-- Public SELECT policies (metadata-only tables)
-- ----------------------------------------------------------------------------
create policy ml_select_all  on public.model_lines         for select using (true);
create policy ver_select_all on public.versions            for select using (true);
create policy ch_select_all  on public.channels            for select using (true);
create policy chh_select_all on public.channel_history     for select using (true);
create policy cd_select_all  on public.channel_deployments for select using (true);

-- ----------------------------------------------------------------------------
-- Authenticated SELECT policies (sensitive tables)
-- ----------------------------------------------------------------------------
create policy runs_select_auth on public.runs
  for select using (auth.role() = 'authenticated' or public.is_admin());

create policy rm_select_auth on public.run_metrics
  for select using (auth.role() = 'authenticated' or public.is_admin());

-- ----------------------------------------------------------------------------
-- Admin write policies (all tables)
-- ----------------------------------------------------------------------------
create policy ml_admin_write  on public.model_lines         for all using (public.is_admin()) with check (public.is_admin());
create policy runs_admin_write on public.runs               for all using (public.is_admin()) with check (public.is_admin());
create policy rm_admin_write   on public.run_metrics        for all using (public.is_admin()) with check (public.is_admin());
create policy ver_admin_write  on public.versions           for all using (public.is_admin()) with check (public.is_admin());
create policy ch_admin_write   on public.channels           for all using (public.is_admin()) with check (public.is_admin());
create policy chh_admin_write  on public.channel_history    for all using (public.is_admin()) with check (public.is_admin());
create policy cd_admin_write   on public.channel_deployments for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Grants — RLS still gates, but grants are required for the role to attempt access
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on
  public.model_lines,
  public.versions,
  public.channels,
  public.channel_history,
  public.channel_deployments
to anon, authenticated;

grant select on public.runs, public.run_metrics to authenticated;

grant insert, update, delete on
  public.model_lines,
  public.runs,
  public.run_metrics,
  public.versions,
  public.channels,
  public.channel_history,
  public.channel_deployments
to authenticated;
