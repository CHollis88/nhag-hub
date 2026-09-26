-- NHAG Church Hub — v67: multi-translation Bible
--
-- Adds two things: a bounded cache for externally-fetched chapter text,
-- and a per-user translation preference.
--
-- Translations: KJV (local, data/bible/kjv), ESV (Crossway API),
-- NLT (Tyndale API). Both publishers allow 5,000 requests/day on their
-- free non-commercial tier, counted separately -- so this cache is a
-- latency optimization, NOT the thing holding the feature up. If it
-- were emptied tomorrow nothing would break.
--
-- WHY THE CACHE IS BOUNDED AND EXPIRES
--   * Publishers push text corrections. A cache that never expires
--     would serve stale scripture indefinitely.
--   * An UNBOUNDED cache that accumulates every chapter anyone opens
--     would, over time, become a complete local copy of ESV and NLT in
--     our database -- which is what these licences don't permit. A
--     bounded, expiring cache stays a cache. Do not remove the
--     eviction or raise the cap to "unlimited" as a performance tweak;
--     that changes what this table legally is.
--   * ESV IS NOT CACHED AT ALL. Crossway's terms cap local storage at
--     500 verses (~a dozen chapters), which is far below any useful
--     cache size, so lib/bibleCache.js skips ESV entirely and fetches
--     it live every time. At 5,000 requests/day that costs nothing.
--     Don't "fix" this by adding ESV to the cache.
--
-- The cap is enforced in app code (lib/bibleCache.js) on write: 300
-- rows per translation, least-recently-read evicted first.

create table if not exists bible_chapter_cache (
  id            bigserial primary key,
  translation   text        not null,
  book          text        not null,
  chapter       int         not null,
  verses        jsonb       not null,
  copyright     text,
  fetched_at    timestamptz not null default now(),
  last_read_at  timestamptz not null default now(),
  unique (translation, book, chapter)
);

-- Lookup path for a cache hit.
create index if not exists idx_bible_cache_lookup
  on bible_chapter_cache (translation, book, chapter);

-- Supports both the TTL sweep and LRU eviction.
create index if not exists idx_bible_cache_evict
  on bible_chapter_cache (translation, last_read_at);

-- ── Reading translation preference ───────────────────────────────────
-- Lives on `users`, next to `active_reading_plan`, because that's where
-- plan selection already lives (see /api/reading-plan/selection) --
-- there is no separate selections table.
--
-- Per-user, not per-plan: two people on the same plan can read it in
-- different translations. Defaults to KJV, which is local and always
-- available, so an unset preference never depends on an external API
-- being up or in quota.
alter table users
  add column if not exists preferred_translation text not null default 'kjv';

-- ── Highlights become per-translation ────────────────────────────────
-- A highlight stores word positions (start_pos/end_pos) -- an index
-- into that verse's token list. Those indices only mean anything within
-- the translation they were made in: "words 3 through 7 of Genesis 1:1"
-- points at different words in the KJV than in the ESV, because the
-- translations word the verse differently. Without this column, a
-- highlight made while reading the KJV would render as a coloured band
-- across arbitrary words once the reader switched translation.
--
-- Notes and tags are NOT affected -- they attach to a verse range, not
-- to words inside a verse, so they stay meaningful in any translation
-- and deliberately carry over.
--
-- Existing rows all predate multi-translation support, so they're all
-- KJV by definition; the default backfills them correctly.
alter table bible_highlights
  add column if not exists translation text not null default 'kjv';

-- Replaces the old (user_id, book, chapter) lookup -- every read is now
-- scoped to a translation as well.
create index if not exists bible_highlights_lookup_translation
  on bible_highlights (user_id, translation, book, chapter);
