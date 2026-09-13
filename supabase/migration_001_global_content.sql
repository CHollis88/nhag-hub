-- NHAG Church Hub — Phase 2: Home + Hub shell
-- Adds global (church-wide) News and Events. These are distinct from the
-- group-scoped News/Events/Prayer coming in Phase 3's generic group module
-- -- global content is admin-only to write (per the project's decision:
-- "church wide is admin only"), visible to every logged-in user.
--
-- Run this once against the same Supabase project that already has
-- schema.sql applied.

create table if not exists global_news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  -- Nullable on purpose: if the admin who posted this is later deleted,
  -- the post should survive with an anonymous/unknown author rather than
  -- disappearing or blocking the user deletion outright. (An earlier draft
  -- of this table had `not null` here alongside `on delete set null`,
  -- which are contradictory -- deleting the author would fail outright.
  -- Caught in testing before this ever reached a real database.)
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists global_news_created_at_idx on global_news (created_at desc);

create table if not exists global_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  event_time text,
  location text,
  notes text,
  -- Same reasoning as global_news.created_by above -- nullable, not
  -- not-null, so deleting the creating admin doesn't fail or take the
  -- event down with them.
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists global_events_date_idx on global_events (event_date);

alter table global_news enable row level security;
alter table global_events enable row level security;

-- No policies created here on purpose -- same posture as schema.sql. All
-- reads and writes happen through this app's /app/api routes using the
-- service role key server-side.
