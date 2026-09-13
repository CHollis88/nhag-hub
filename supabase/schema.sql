-- NHAG Church Hub — Foundation schema
-- Run this whole file once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- This is a brand-new project/database — no migration from the Young Adults
-- or Choir apps. Those stay on their own separate Supabase projects, untouched.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Users: one row per real person, forever. Replaces the old device_id model.
-- ---------------------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  username text unique,
  display_name text,
  is_church_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- username/display_name are nullable at the DB level on purpose: a user row
-- is created the moment a magic link is first verified, but the person
-- hasn't chosen a username yet until they complete signup (see
-- /api/auth/complete-signup). "Profile incomplete" = username is null.

create unique index if not exists users_username_lower_unique
  on users (lower(username))
  where username is not null;

create index if not exists users_email_lower_idx on users (lower(email));

-- ---------------------------------------------------------------------------
-- Magic links: short-lived, one-time login tokens.
-- ---------------------------------------------------------------------------
create table if not exists magic_links (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists magic_links_email_idx on magic_links (lower(email));
create index if not exists magic_links_token_idx on magic_links (token);

-- ---------------------------------------------------------------------------
-- Sessions: persistent, multi-device. No expiry — alive until explicitly
-- revoked (user signs out, or an admin revokes as a recovery action).
-- ---------------------------------------------------------------------------
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on sessions (user_id);
create index if not exists sessions_token_idx on sessions (token);

-- ---------------------------------------------------------------------------
-- Groups: Choir, each Sunday School class, etc. Standing / permanent —
-- no per-semester cycling.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Groups: Choir, Sunday School classes, Wednesday Night, Security, Young
-- Adults -- any ministry is just a group with a name. There's no fixed
-- template of ministry "types": `type` is a free-text label the admin
-- types in (or leaves blank), used only for display, never constrained.
-- What varies between groups is which OPTIONAL modules they've turned on
-- (see `features` below), not what category they belong to.
-- ---------------------------------------------------------------------------
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default '',
  -- Opt-in module keys. Recognized today: 'songs_setlists' (song library +
  -- setlists, e.g. for Choir) and 'reading_plan_journal' (Bible reading
  -- plan + private journal, e.g. for Young Adults). The application layer
  -- defines what a key unlocks in the UI -- a new feature is a new key,
  -- never a schema change.
  features text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Group members: who's in what group, at what level, and whether they're
-- fully in yet (active) or waiting on leader approval (pending).
-- ---------------------------------------------------------------------------
create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('leader', 'member')),
  status text not null check (status in ('active', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index if not exists group_members_group_idx on group_members (group_id, status);
create index if not exists group_members_user_idx on group_members (user_id, status);

-- ---------------------------------------------------------------------------
-- Group promotion requests: leader asks to push a group News post to the
-- global feed. Table defined now since it's part of the roles/groups model;
-- routes stay stubbed (501) until Phase 3 adds group_news / global_news.
-- ---------------------------------------------------------------------------
create table if not exists group_promotion_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  requested_by uuid not null references users(id) on delete cascade,
  source_type text not null check (source_type in ('news')),
  source_id uuid not null,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled on every table, same posture as the existing
-- apps. The browser never talks to Supabase directly — only this app's own
-- /app/api routes do, using the service role key server-side (which bypasses
-- RLS). No public policies needed; this is a safety net only.
-- ---------------------------------------------------------------------------
alter table users enable row level security;
alter table magic_links enable row level security;
alter table sessions enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_promotion_requests enable row level security;
