-- =============================================================================
-- Migration 01 — model_lines
-- =============================================================================
-- Registry of trainable model definitions. Each row defines ONE model family
-- (source weights, target hardware, class set, artifact contract). Training
-- runs are scoped to a model_line. BSCP is the first row; future projects
-- (other detection/segmentation models) become additional rows — no schema
-- change needed.
-- =============================================================================

create table public.model_lines (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  display_name text not null,
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table  public.model_lines is
  'Trainable model family definitions. One row per (source model × target hardware × dataset shape) tuple.';
comment on column public.model_lines.slug is
  'URL-safe identifier, e.g. "yolo11s-sack-hailo8l".';

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger model_lines_set_updated_at
  before update on public.model_lines
  for each row execute function public.set_updated_at();

-- Seed: first BSCP model line
insert into public.model_lines (slug, display_name, description)
values (
  'yolo11s-sack-hailo8l',
  'BSCP Sack Detector — YOLO 11s → Hailo-8L',
  'YOLO 11s detection model for sack counting, compiled to HEF for Hailo-8L on Raspberry Pi 5.'
);
