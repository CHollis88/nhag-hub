-- v71_16: three extra, nameable track slots per song (e.g. "Soprano - Lowered").
-- A slot is just a label + a link. Both stay empty until a leader fills them in.
-- Idempotent: safe to run twice.
alter table public.group_songs
  add column if not exists extra1_label text, add column if not exists extra1_url text,
  add column if not exists extra2_label text, add column if not exists extra2_url text,
  add column if not exists extra3_label text, add column if not exists extra3_url text;
alter table public.program_songs
  add column if not exists extra1_label text, add column if not exists extra1_url text,
  add column if not exists extra2_label text, add column if not exists extra2_url text,
  add column if not exists extra3_label text, add column if not exists extra3_url text;
