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
    token_plain text not null,
    token_hash text not null
);

alter table public.invite_tokens
    add column if not exists token_plain text;

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

insert into public.invites (code, name, status, updated_at) values
('a7k2', 'Светлана и Даниил', null, now()),
('b4m9', 'Саша, Лена и Эмилия', null, now()),
('c8q1', 'Женя, Серёжа, Наеми, Инес, Джоэль', null, now()),
('d3p6', 'Артур & Кристина', null, now()),
('e5t0', 'Оля', null, now()),
('f2n7', 'Света, Юра и Андрей', null, now()),
('g9r4', 'Марша и Титас', null, now()),
('h6v8', 'Зури и Натали', null, now()),
('j1x3', 'Мама Оля и Папа Володя', null, now())
on conflict (code) do update set name = excluded.name;

-- Store invite tokens and their hashes
insert into public.invite_tokens (code, token_plain, token_hash) values
('a7k2', 'tk_A7m2v9Lq', encode(digest('tk_A7m2v9Lq', 'sha256'), 'hex')),
('b4m9', 'tk_B4p8n1Xr', encode(digest('tk_B4p8n1Xr', 'sha256'), 'hex')),
('c8q1', 'tk_C8k5t3Wd', encode(digest('tk_C8k5t3Wd', 'sha256'), 'hex')),
('d3p6', 'tk_D3z7r2Ua', encode(digest('tk_D3z7r2Ua', 'sha256'), 'hex')),
('e5t0', 'tk_E5h4y6Pn', encode(digest('tk_E5h4y6Pn', 'sha256'), 'hex')),
('f2n7', 'tk_F2q9m8Sb', encode(digest('tk_F2q9m8Sb', 'sha256'), 'hex')),
('g9r4', 'tk_G9x1c7Le', encode(digest('tk_G9x1c7Le', 'sha256'), 'hex')),
('h6v8', 'tk_H6n3w5Ko', encode(digest('tk_H6n3w5Ko', 'sha256'), 'hex')),
('j1x3', 'tk_J1r8v4Ti', encode(digest('tk_J1r8v4Ti', 'sha256'), 'hex'))
on conflict (code) do update set
    token_plain = excluded.token_plain,
    token_hash = excluded.token_hash;
