-- NHAG Church Hub — Programs (bolt-on ministry feature)
--
-- A "Programs" tab, available to any ministry that opts in via the
-- existing `features` array on groups (same pattern as the
-- 'songs_setlists' and 'reading_plan_journal' keys already in use --
-- see app/api/groups/route.js's VALID_FEATURES). Enabled for Choir now;
-- Cam specifically anticipates a future Kids Ministry using it too, so
-- this is deliberately NOT Choir-specific in the schema.
--
-- Each program is a card (icon + color, same visual language as a
-- ministry tile) that opens into its own mini-shell with three tabs:
-- Songs, Setlist, Documents. Per Cam's explicit answer, a program's
-- song library is FULLY SEPARATE from its parent ministry's main
-- Songs tab -- not shared -- hence program_songs/program_setlists as
-- their own tables scoped to program_id, mirroring group_songs/
-- group_setlists/group_setlist_songs structurally rather than reusing
-- them with an added column, so a program's data can never accidentally
-- leak into or share rows with the ministry's own library.
--
-- Programs are individually hideable (Cam's requirement), same idea as
-- ministry-level hiding but scoped to one program: hidden programs are
-- excluded from the Programs tab's card grid for anyone who isn't a
-- leader/admin of the parent group (leaders/admins still see and can
-- unhide them -- enforced at the application layer, same pattern as
-- 'leader'-kind news posts).

create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  image_url text,
  tile_color text,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists programs_group_idx on programs (group_id, name);

create table if not exists program_songs (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
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

create index if not exists program_songs_program_idx on program_songs (program_id, title);

create table if not exists program_setlists (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  service_date date not null,
  service text not null check (service in ('AM', 'PM', 'CP')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists program_setlists_program_idx on program_setlists (program_id, service_date desc);

create table if not exists program_setlist_songs (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references program_setlists(id) on delete cascade,
  song_id uuid not null references program_songs(id) on delete cascade,
  note text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists program_setlist_songs_setlist_idx on program_setlist_songs (setlist_id, position);

-- Documents (PDF upload). file_url points into the "program-documents"
-- Storage bucket, created on first use the same idempotent way
-- group-icons already is (see app/api/groups/[id]/icon/route.js) --
-- no manual dashboard step.
create table if not exists program_documents (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  title text not null,
  file_url text not null,
  uploaded_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists program_documents_program_idx on program_documents (program_id, created_at desc);

alter table programs enable row level security;
alter table program_songs enable row level security;
alter table program_setlists enable row level security;
alter table program_setlist_songs enable row level security;
alter table program_documents enable row level security;
