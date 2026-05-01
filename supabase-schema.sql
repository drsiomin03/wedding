-- Run this in Supabase SQL editor

create table if not exists public.invites (
    code text primary key,
    name text not null,
    status text not null check (status in ('yes', 'no')),
    updated_at timestamptz not null default now()
);

alter table public.invites enable row level security;

-- Public read (needed for guests dashboard page)
drop policy if exists "Public can read invites" on public.invites;
create policy "Public can read invites"
on public.invites
for select
to anon
using (true);

-- Public write by code (needed for invite page)
drop policy if exists "Public can upsert invites" on public.invites;
create policy "Public can upsert invites"
on public.invites
for insert
to anon
with check (true);

drop policy if exists "Public can update invites" on public.invites;
create policy "Public can update invites"
on public.invites
for update
to anon
using (true)
with check (true);

drop policy if exists "Public can delete invites" on public.invites;
create policy "Public can delete invites"
on public.invites
for delete
to anon
using (true);
