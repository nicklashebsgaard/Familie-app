create extension if not exists pgcrypto;

-- Invitation tokens for family join links
create table public.invite_tokens (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  token       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by  uuid references auth.users(id),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.invite_tokens enable row level security;

-- Anyone can read a token to validate it during the join flow
create policy "invite_tokens: readable by anyone"
  on public.invite_tokens for select
  using (true);

create policy "invite_tokens: admins can create"
  on public.invite_tokens for insert
  with check (
    family_id = public.current_family_id()
    and public.current_role() = 'admin'
  );

create policy "invite_tokens: admins can delete"
  on public.invite_tokens for delete
  using (
    family_id = public.current_family_id()
    and public.current_role() = 'admin'
  );

-- push_subscriptions for web push notifications (Phase 5)
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  family_id   uuid not null references public.families(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: self manage"
  on public.push_subscriptions for all
  using (user_id = auth.uid());
