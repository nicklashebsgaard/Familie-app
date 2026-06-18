-- Add participants array to events (list of "auth:uuid" or "managed:uuid" strings)
alter table public.events
  add column if not exists participants jsonb not null default '[]'::jsonb;
