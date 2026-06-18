-- ─── FAMILIES ───────────────────────────────────────────────────────────────
create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ─── USERS (profile table, extends auth.users) ──────────────────────────────
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text not null,
  color       text not null default '#6366f1',
  role        text not null default 'member'
              check (role in ('admin', 'member', 'guest')),
  family_id   uuid references public.families(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ─── EVENTS ─────────────────────────────────────────────────────────────────
create table public.events (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  title         text not null,
  description   text,
  location      text,
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  all_day       boolean not null default false,
  recurring     jsonb,
  source        text not null default 'manual'
                check (source in ('manual', 'aula')),
  aula_uid      text,
  transport     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (family_id, aula_uid)
);

-- ─── AULA FEEDS ─────────────────────────────────────────────────────────────
create table public.aula_feeds (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families(id) on delete cascade,
  user_id          uuid not null references public.users(id) on delete cascade,
  child_name       text not null,
  ics_url          text not null,
  last_synced_at   timestamptz,
  last_event_count integer,
  last_error       text,
  created_at       timestamptz not null default now()
);

-- ─── UPDATED_AT TRIGGER ─────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();
