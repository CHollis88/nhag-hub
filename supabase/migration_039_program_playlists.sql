-- v71_18: personal playlists inside a program (the program's "Playlist" tab,
-- Custom mode). A playlist is PRIVATE to the person who made it and belongs to
-- one program. Each entry is one specific track of one specific song, e.g.
-- "Song 3 / Alto" or "Song 1 / Demo", in an order the person chooses.
--
-- track_key is the song column that holds the link (alto_url, demo_url,
-- extra2_url ...). Entries point at the SLOT, not at the track's name, so
-- renaming a custom track never breaks a playlist. Deleting a song removes its
-- entries; emptying a link just makes that entry skip at play time.
--
-- Same posture as every other table: RLS on with no policies, because all
-- access goes through the app's server (service role). Idempotent.
create table if not exists public.program_playlists (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists program_playlists_owner_idx on public.program_playlists (program_id, user_id);

create table if not exists public.program_playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.program_playlists(id) on delete cascade,
  program_song_id uuid not null references public.program_songs(id) on delete cascade,
  track_key text not null,
  position int not null,
  created_at timestamptz not null default now()
);
create index if not exists program_playlist_items_order_idx on public.program_playlist_items (playlist_id, position);
create index if not exists program_playlist_items_song_idx on public.program_playlist_items (program_song_id);

alter table public.program_playlists enable row level security;
alter table public.program_playlist_items enable row level security;
