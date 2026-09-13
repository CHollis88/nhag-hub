-- NHAG Church Hub — Phase 4: Choir migration
-- The "bolted on top" piece per the project's decision: every group
-- already gets News/Events/Prayer/Roster from Phase 3's generic module.
-- Songs and Setlists are Choir-specific extras, scoped by group_id so the
-- same tables could serve another music-type group later without a
-- redesign, even though only 'choir' groups expose this in the UI today.
--
-- Run after schema.sql, migration_001_global_content.sql, and
-- migration_002_group_content.sql.
--
-- Per the project's decision ("fresh start, no migration of existing
-- data"), this does NOT import anything from the old Choir app's
-- database -- it's a fresh, empty library. The choir director re-adds
-- songs/setlists as needed once this is live.

create table if not exists group_songs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  composer text,
  times_sung int,
  first_date date,
  most_recent_date date,
  lyrics_url text,
  chords_url text,
  sheet_music_url text,
  soprano_url text,
  alto_url text,
  tenor_url text,
  bass_url text,
  full_mix_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists group_songs_group_idx on group_songs (group_id, title);

create table if not exists group_setlists (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  service_date date not null,
  service text not null check (service in ('AM', 'PM', 'CP')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists group_setlists_group_idx on group_setlists (group_id, service_date desc);

create table if not exists group_setlist_songs (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references group_setlists(id) on delete cascade,
  song_id uuid not null references group_songs(id) on delete cascade,
  note text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists group_setlist_songs_setlist_idx on group_setlist_songs (setlist_id, position);

alter table group_songs enable row level security;
alter table group_setlists enable row level security;
alter table group_setlist_songs enable row level security;
