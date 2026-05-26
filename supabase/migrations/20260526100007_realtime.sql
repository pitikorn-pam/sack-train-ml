-- =============================================================================
-- Migration 07 — Realtime publication + replica identity
-- =============================================================================
-- Add tables to supabase_realtime so the web dashboard can stream live
-- updates over WebSocket (training metrics, run status, channel promotions).
--
-- REPLICA IDENTITY FULL ensures DELETE events carry the full row, not just
-- the primary key — needed so Realtime subscribers can match deleted rows
-- by columns other than PK (e.g. by run_id on run_metrics deletes).
-- =============================================================================

alter table public.runs                 replica identity full;
alter table public.run_metrics          replica identity full;
alter table public.versions             replica identity full;
alter table public.channels             replica identity full;
alter table public.channel_deployments  replica identity full;

-- Add to Realtime publication
alter publication supabase_realtime add table public.runs;
alter publication supabase_realtime add table public.run_metrics;
alter publication supabase_realtime add table public.versions;
alter publication supabase_realtime add table public.channels;
alter publication supabase_realtime add table public.channel_deployments;
