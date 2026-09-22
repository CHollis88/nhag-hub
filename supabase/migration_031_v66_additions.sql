-- NHAG Church Hub — v66 additions
--
-- The one schema change added after migration_030 was already run in
-- production: the song link rename/addition. (Sermon drafts'
-- `sermons.status` column was applied separately already -- not
-- repeated here.) Kept in its own file rather than folded back into
-- migration_030, since that one's already been applied and editing an
-- already-run migration in place is exactly the kind of thing that
-- causes a "wait, what state is production actually in?" problem down
-- the line.

-- ── Song Links: "Full Mix" renamed to "Split Track", new "Demo" slot ──
-- Cam's decision: full_mix_url -> split_track_url (same column, new
-- name and meaning -- a click track / instrument-only reference, not
-- necessarily "everyone singing together"), plus a new demo_url slot
-- for a simple sing-along reference recording. Applies to both
-- group_songs (Choir's main library) and program_songs (Programs'
-- per-program libraries, migration_025), since they share the same
-- shape and the same SongForm/SongsTab UI.
--
-- NOTE: the two `rename column` lines below are NOT safe to re-run
-- once they've succeeded once -- a second run would fail with
-- "column full_mix_url does not exist" (the add-column lines are
-- still safe to re-run). Run this file once, the normal way.
alter table group_songs rename column full_mix_url to split_track_url;
alter table group_songs add column if not exists demo_url text;

alter table program_songs rename column full_mix_url to split_track_url;
alter table program_songs add column if not exists demo_url text;
