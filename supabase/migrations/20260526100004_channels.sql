-- =============================================================================
-- Migration 04 — channels + channel_history
-- =============================================================================
-- channels: a named pointer to a version per model_line, e.g. (dev, staging,
--   production). Runtime polls "what is current version on channel X?".
--   One row per (model_line, channel_name).
--
-- channel_history: audit log of every channel→version promotion. Append-only.
-- =============================================================================

create table public.channels (
  id                  uuid primary key default gen_random_uuid(),
  model_line_id       uuid not null references public.model_lines(id) on delete restrict,
  name                text not null,
  current_version_id  uuid references public.versions(id) on delete restrict,
  updated_at          timestamptz not null default now(),
  unique (model_line_id, name)
);

create index channels_model_line_idx    on public.channels (model_line_id);
create index channels_current_version   on public.channels (current_version_id);

comment on table  public.channels is
  'Named pointer to a version per model line. Used by runtime to resolve "latest on channel X".';

-- ----------------------------------------------------------------------------
-- Audit trail for channel promotions
-- ----------------------------------------------------------------------------
create table public.channel_history (
  id              uuid primary key default gen_random_uuid(),
  channel_id      uuid not null references public.channels(id) on delete cascade,
  from_version_id uuid references public.versions(id) on delete set null,
  to_version_id   uuid references public.versions(id) on delete set null,
  changed_at      timestamptz not null default now(),
  changed_by      uuid  -- auth.uid() when available
);

create index channel_history_channel_idx on public.channel_history (channel_id, changed_at desc);

comment on table public.channel_history is
  'Append-only audit log of channel promotions. One row per current_version_id change.';

-- Audit trigger: log every change to channels.current_version_id
create or replace function public.channels_audit()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.current_version_id is distinct from old.current_version_id then
    insert into public.channel_history (channel_id, from_version_id, to_version_id, changed_by)
    values (new.id, old.current_version_id, new.current_version_id, auth.uid());
  elsif tg_op = 'INSERT' and new.current_version_id is not null then
    insert into public.channel_history (channel_id, from_version_id, to_version_id, changed_by)
    values (new.id, null, new.current_version_id, auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger channels_audit
  before insert or update of current_version_id on public.channels
  for each row execute function public.channels_audit();

-- Seed default channels for the first model line
insert into public.channels (model_line_id, name)
select id, ch.name
from public.model_lines, (values ('dev'), ('staging'), ('production')) as ch(name)
where slug = 'yolo11s-sack-hailo8l';
