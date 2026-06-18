-- Managed members: children or people without their own auth account
create table public.managed_members (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  name        text not null,
  color       text not null default '#22c55e',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.managed_members enable row level security;

create policy "managed_members: family can read"
  on public.managed_members for select
  using (family_id = public.current_family_id());

create policy "managed_members: admins can insert"
  on public.managed_members for insert
  with check (family_id = public.current_family_id() and public.current_role() = 'admin');

create policy "managed_members: admins can update"
  on public.managed_members for update
  using (family_id = public.current_family_id() and public.current_role() = 'admin');

create policy "managed_members: admins can delete"
  on public.managed_members for delete
  using (family_id = public.current_family_id() and public.current_role() = 'admin');

-- Link events to a managed member (optional — takes visual precedence over user_id for display)
alter table public.events
  add column managed_member_id uuid references public.managed_members(id) on delete set null;

-- Allow events created for managed members to pass the member insert policy
-- (user_id = auth.uid() = the parent who created it; managed_member_id identifies the child)
-- Existing "events: member insert own" already covers this since user_id = auth.uid().

-- Aula feeds can also be linked to a managed member so synced events show under the child
alter table public.aula_feeds
  add column managed_member_id uuid references public.managed_members(id) on delete set null;
