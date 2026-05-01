-- Run this in Supabase SQL editor

create table if not exists public.invites (
    code text primary key,
    name text not null,
    status text check (status in ('yes', 'no')),
    updated_at timestamptz not null default now()
);

create extension if not exists pgcrypto;

create table if not exists public.invite_tokens (
    code text primary key references public.invites(code) on delete cascade,
    token_hash text not null
);

alter table public.invites enable row level security;
alter table public.invite_tokens enable row level security;

-- Public read (needed for guests dashboard page)
drop policy if exists "Public can read invites" on public.invites;
create policy "Public can read invites"
on public.invites
for select
to anon
using (true);

-- Disable direct anon writes; writes go through Edge Function (service role)
drop policy if exists "Public can upsert invites" on public.invites;
drop policy if exists "Public can update invites" on public.invites;
drop policy if exists "Public can delete invites" on public.invites;

-- Store hashed tokens (plain tokens are in guests.html)
insert into public.invite_tokens (code, token_hash) values
('a7k2', encode(digest('tk_A7m2v9Lq', 'sha256'), 'hex')),
('b4m9', encode(digest('tk_B4p8n1Xr', 'sha256'), 'hex')),
('c8q1', encode(digest('tk_C8k5t3Wd', 'sha256'), 'hex')),
('d3p6', encode(digest('tk_D3z7r2Ua', 'sha256'), 'hex')),
('e5t0', encode(digest('tk_E5h4y6Pn', 'sha256'), 'hex')),
('f2n7', encode(digest('tk_F2q9m8Sb', 'sha256'), 'hex')),
('g9r4', encode(digest('tk_G9x1c7Le', 'sha256'), 'hex')),
('h6v8', encode(digest('tk_H6n3w5Ko', 'sha256'), 'hex')),
('j1x3', encode(digest('tk_J1r8v4Ti', 'sha256'), 'hex'))
on conflict (code) do update set token_hash = excluded.token_hash;
