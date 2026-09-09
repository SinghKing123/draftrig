-- Twinbench database schema.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- It is safe to run more than once.
--
-- The security model is row-level: every policy is scoped to auth.uid(), so a
-- signed-in user can only ever reach their own rows. There is no application
-- code that can accidentally leak someone else's project, because the database
-- itself refuses.

create extension if not exists "pgcrypto";

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
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
  using (auth.uid() = owner or is_public);

drop policy if exists "insert own projects" on public.projects;
create policy "insert own projects"
  on public.projects for insert
  with check (auth.uid() = owner);

drop policy if exists "update own projects" on public.projects;
create policy "update own projects"
  on public.projects for update
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

drop policy if exists "delete own projects" on public.projects;
create policy "delete own projects"
  on public.projects for delete
  using (auth.uid() = owner);

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

-- A row per user, created automatically on sign-up. This is where a plan or a
-- billing customer id will live when subscriptions are added; keeping it
-- separate from auth.users means we never write to Supabase's own tables.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
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
  on public.profiles for select using (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Create the profile row the moment someone signs up, so the app never has to
-- handle a signed-in user with no profile.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
