-- NHAG Church Hub — enable Row Level Security on the last four tables
-- that didn't have it.
--
-- Supabase's security advisor flagged these as ERROR ("RLS Disabled in
-- Public"): without RLS, anyone holding this project's public anon key
-- could read or write them directly through the REST API, bypassing the
-- app entirely. notifications holds per-member private content, so this
-- one matters.
--
-- Safe for the app: every query goes through lib/supabaseServer.js with
-- the SERVICE ROLE key, which bypasses RLS. Enabling RLS with no
-- policies (same as the other 45 tables) just denies direct public
-- access -- the app itself behaves exactly the same.
--
-- Idempotent: enabling RLS on a table that already has it is a no-op.

alter table public.sermons             enable row level security;
alter table public.admin_activity_log  enable row level security;
alter table public.notifications       enable row level security;
alter table public.bible_chapter_cache enable row level security;
