-- =============================================================================
-- Migration 09 — runs.requested_config
-- =============================================================================
-- Provenance keeps three layers, not one (see issue 07):
--
--   1. requested_config — exactly what was submitted
--   2. config_yaml      — after our defaults resolve, written by start-training
--   3. the run's own record — after ultralytics fills the remaining ~100 keys,
--                             which is the only layer that can name a value
--                             nobody chose. That is the class the Muon crash
--                             belonged to: `optimizer` was never requested by
--                             anyone, it arrived from ultralytics' own "auto".
--
-- Layer 2 already had a home in `config_yaml`. This adds layer 1, so "what did
-- they ask for?" and "what actually ran?" stop being the same field.
-- =============================================================================

alter table public.runs
  add column if not exists requested_config jsonb;

comment on column public.runs.requested_config is
  'The config exactly as submitted, before any default resolved. config_yaml holds the resolved form.';
