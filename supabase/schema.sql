-- Draftrig database schema.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query). It is safe to run more than once.
--
-- Identity comes from Auth0, not from Supabase. Supabase is configured to
-- trust Auth0's signing keys (Dashboard -> Authentication -> Third-Party
-- Auth), every request from the browser carries an Auth0 access token, and the
-- policies below read the caller out of that token.
--
-- That is why nothing here mentions auth.uid() or auth.users. auth.uid() reads
-- the subject of a token Supabase issued itself, and Supabase no longer issues
-- one — it would be null on every request, so a policy written against it
-- matches no rows and every read comes back empty with no error to explain it.
-- The subject of the Auth0 token is what identifies a caller, and it is a
-- string like 'google-oauth2|10769150350006150715' rather than a uuid.

create extension if not exists "pgcrypto";

-- The caller, according to the token they presented. Null when anonymous.
create or replace function public.auth_sub()
returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')
$$;

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  -- An Auth0 subject. Text, and with no foreign key, because the users live
  -- in Auth0 and this database has no table to point at.
  owner       text not null,
  name        text not null default 'Untitled build',
  -- The whole document: parts by id plus their parameters and connections.
  -- No geometry is stored; it is regenerated on load.
  doc         jsonb not null,
  part_count  integer not null default 0,
  -- Set true to make a project readable by anyone with the link.
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_owner_updated_idx
  on public.projects (owner, updated_at desc);

create index if not exists projects_public_idx
  on public.projects (is_public, updated_at desc) where is_public;

-- Keep updated_at honest even if a client forgets to send it.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

alter table public.projects enable row level security;

drop policy if exists "own projects are readable" on public.projects;
create policy "own projects are readable"
  on public.projects for select
  using (public.auth_sub() = owner or is_public);

drop policy if exists "insert own projects" on public.projects;
create policy "insert own projects"
  on public.projects for insert
  with check (public.auth_sub() = owner);

drop policy if exists "update own projects" on public.projects;
create policy "update own projects"
  on public.projects for update
  using (public.auth_sub() = owner)
  with check (public.auth_sub() = owner);

drop policy if exists "delete own projects" on public.projects;
create policy "delete own projects"
  on public.projects for delete
  using (public.auth_sub() = owner);

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

-- A row per user. Auth0 holds the real account; this is the part of it this
-- database needs to join against, plus somewhere for a plan or a billing
-- customer id to live when subscriptions are added.
--
-- There is no trigger filling this in. The old schema had one on
-- auth.users, which fired when Supabase created an account; nothing inserts
-- into auth.users any more, so the app writes its own row on first sign-in.
create table if not exists public.profiles (
  id           text primary key,
  email        text,
  display_name text,
  avatar_url   text,
  -- 'free' today. Stripe will set this later; nothing reads it yet.
  plan         text not null default 'free',
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select using (public.auth_sub() = id);

drop policy if exists "upsert own profile" on public.profiles;
create policy "upsert own profile"
  on public.profiles for insert with check (public.auth_sub() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  using (public.auth_sub() = id) with check (public.auth_sub() = id);

/* ------------------------------------------------------------------ */
/* Migrating from the Supabase-auth version of this schema              */
/* ------------------------------------------------------------------ */

-- Only needed if the old schema was ever run and has rows in it. The owner
-- column was a uuid keyed to auth.users; there is no way to map those to
-- Auth0 subjects automatically, so this is here to be read rather than run.
--
--   alter table public.projects drop constraint if exists projects_owner_fkey;
--   alter table public.projects alter column owner type text using owner::text;
--   drop trigger if exists on_auth_user_created on auth.users;
--   drop function if exists public.handle_new_user();
--
-- After that, existing rows carry uuids no signed-in caller will ever match,
-- so they are invisible rather than dangerous. Delete them or reassign them by
-- hand once you know which Auth0 account each belongs to.
