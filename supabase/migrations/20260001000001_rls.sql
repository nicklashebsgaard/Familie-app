-- ─── ENABLE RLS ─────────────────────────────────────────────────────────────
alter table public.families   enable row level security;
alter table public.users      enable row level security;
alter table public.events     enable row level security;
alter table public.aula_feeds enable row level security;

-- ─── HELPERS ────────────────────────────────────────────────────────────────
-- SECURITY DEFINER bypasses RLS so these functions don't cause infinite recursion
-- when called from within the users table RLS policies
create or replace function public.current_family_id()
returns uuid language sql stable security definer as $$
  select family_id from public.users where id = auth.uid()
$$;

create or replace function public.current_role()
returns text language sql stable security definer as $$
  select role from public.users where id = auth.uid()
$$;

-- ─── FAMILIES ────────────────────────────────────────────────────────────────
create policy "families: members see own family"
  on public.families for select
  using (id = public.current_family_id());

create policy "families: admins can update"
  on public.families for update
  using (id = public.current_family_id() and public.current_role() = 'admin');

-- ─── USERS ───────────────────────────────────────────────────────────────────
create policy "users: family members can read"
  on public.users for select
  using (family_id = public.current_family_id());

create policy "users: self update"
  on public.users for update
  using (id = auth.uid());

create policy "users: self insert"
  on public.users for insert
  with check (id = auth.uid());

-- ─── EVENTS ──────────────────────────────────────────────────────────────────
create policy "events: family can read"
  on public.events for select
  using (family_id = public.current_family_id());

create policy "events: admin full write"
  on public.events for all
  using (
    family_id = public.current_family_id()
    and public.current_role() = 'admin'
  );

create policy "events: member insert own"
  on public.events for insert
  with check (
    family_id = public.current_family_id()
    and user_id = auth.uid()
    and public.current_role() = 'member'
  );

create policy "events: member update own"
  on public.events for update
  using (
    family_id = public.current_family_id()
    and user_id = auth.uid()
    and public.current_role() = 'member'
  );

create policy "events: member delete own"
  on public.events for delete
  using (
    family_id = public.current_family_id()
    and user_id = auth.uid()
    and public.current_role() = 'member'
  );

-- ─── AULA FEEDS ──────────────────────────────────────────────────────────────
create policy "aula_feeds: family can read"
  on public.aula_feeds for select
  using (family_id = public.current_family_id());

create policy "aula_feeds: admins can manage"
  on public.aula_feeds for all
  using (
    family_id = public.current_family_id()
    and public.current_role() = 'admin'
  );
