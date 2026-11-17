-- NHAG Church Hub — migration 040 (v71.29)
--
--   1. Church-wide prayer: global_prayer + global_prayer_supporters, and
--      toggle_global_prayer() (same locked, atomic "I'm praying" toggle as
--      toggle_prayer in migration_034, for church-wide requests).
--   2. app_settings: small key/value store for church settings an admin
--      changes in the Admin Toolbox (church prayer on/off, service times).
--   3. Reactions on church-wide prayer requests ('global_prayer').
--   4. Profile photos: users.avatar_url.
--
-- Idempotent: safe to run more than once. Run it once in the Supabase SQL
-- editor BEFORE deploying v71.29.

-- 1. Church-wide prayer ------------------------------------------------------
create table if not exists global_prayer (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  is_anonymous boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  status text not null default 'open',
  status_updated_at timestamptz,
  pray_count integer not null default 0
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'global_prayer_status_check') then
    alter table global_prayer
      add constraint global_prayer_status_check check (status in ('open', 'answered', 'still-praying'));
  end if;
end $$;

create index if not exists global_prayer_created_idx on global_prayer (created_at desc);

create table if not exists global_prayer_supporters (
  prayer_id uuid not null references global_prayer(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (prayer_id, user_id)
);

alter table global_prayer enable row level security;
alter table global_prayer_supporters enable row level security;

create or replace function toggle_global_prayer(
  p_prayer_id uuid,
  p_user_id uuid
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
  v_removed integer;
  v_praying boolean;
begin
  select pray_count into v_count
    from global_prayer
   where id = p_prayer_id
   for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  delete from global_prayer_supporters where prayer_id = p_prayer_id and user_id = p_user_id;
  get diagnostics v_removed = row_count;

  if v_removed > 0 then
    v_praying := false;
    v_count := greatest(0, coalesce(v_count, 0) - 1);
  else
    insert into global_prayer_supporters (prayer_id, user_id)
    values (p_prayer_id, p_user_id)
    on conflict do nothing;
    v_praying := true;
    v_count := coalesce(v_count, 0) + 1;
  end if;

  update global_prayer set pray_count = v_count where id = p_prayer_id;

  return jsonb_build_object('status', 'ok', 'i_prayed', v_praying, 'pray_count', v_count);
end;
$$;

-- 2. Church settings ---------------------------------------------------------
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id) on delete set null
);
alter table app_settings enable row level security;

-- Church prayer starts ON (an admin can switch it off in the Admin Toolbox);
-- service times start empty (the "This Sunday" card hides until they're set).
insert into app_settings (key, value) values ('church_prayer_enabled', 'true'::jsonb) on conflict (key) do nothing;
insert into app_settings (key, value) values ('service_times', '""'::jsonb) on conflict (key) do nothing;

-- 3. Reactions on church-wide prayer requests -------------------------------
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.post_reactions'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%post_type%'
  loop
    execute format('alter table post_reactions drop constraint %I', c.conname);
  end loop;
  alter table post_reactions
    add constraint post_reactions_post_type_check
    check (post_type in ('group_news', 'global_news', 'group_prayer', 'global_prayer'));
end $$;

-- 4. Profile photos ----------------------------------------------------------
-- The photos themselves live in the public "avatars" storage bucket, which
-- the app creates on first upload (same as ministry icons).
alter table users add column if not exists avatar_url text;

-- 5. NKJV and AMP (API.Bible) ------------------------------------------------
-- NLT now comes from API.Bible too (Tyndale's NLT API closes Jan 1, 2027).
-- Widen the three translation checks so NKJV and AMP chapters can be cached,
-- highlighted, and picked as a preference. Drop-and-re-add, so it's safe to
-- run twice.
alter table bible_chapter_cache drop constraint if exists bible_chapter_cache_translation_check;
alter table bible_chapter_cache add constraint bible_chapter_cache_translation_check
  check (translation in ('kjv', 'esv', 'nlt', 'bsb', 'nkjv', 'amp'));

alter table users drop constraint if exists users_preferred_translation_check;
alter table users add constraint users_preferred_translation_check
  check (preferred_translation in ('kjv', 'esv', 'nlt', 'bsb', 'nkjv', 'amp'));

alter table bible_highlights drop constraint if exists bible_highlights_translation_check;
alter table bible_highlights add constraint bible_highlights_translation_check
  check (translation in ('kjv', 'esv', 'nlt', 'bsb', 'nkjv', 'amp'));

-- The NLT chapters saved from Tyndale are re-fetched from API.Bible on next
-- read (the app's passage format version changed); clear them now so the
-- table doesn't carry dead rows.
delete from bible_chapter_cache where translation = 'nlt';
