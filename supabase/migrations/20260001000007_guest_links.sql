-- Guest links: tokenized public calendar sharing
create table if not exists public.guest_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  created_by uuid not null,
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  label text,
  expires_at timestamptz not null,
  date_from date,
  date_to date,
  created_at timestamptz default now()
);

alter table public.guest_links enable row level security;

-- Drop any old catch-all policy and replace with explicit per-operation policies
drop policy if exists "family_manage" on public.guest_links;
drop policy if exists "family_select" on public.guest_links;
drop policy if exists "family_insert" on public.guest_links;
drop policy if exists "family_delete" on public.guest_links;

create policy "family_select" on public.guest_links
  for select using (
    family_id = (select family_id from public.users where id = auth.uid())
  );

create policy "family_insert" on public.guest_links
  for insert with check (
    family_id = (select family_id from public.users where id = auth.uid())
    and created_by = auth.uid()
  );

create policy "family_delete" on public.guest_links
  for delete using (
    family_id = (select family_id from public.users where id = auth.uid())
  );
