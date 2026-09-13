-- NHAG Church Hub — Bible tab: personal study data
-- The Bible TEXT and reference data (passages, commentary, cross-refs,
-- lexicon, dictionary, glossary, word-lookup, beliefs, browse,
-- chapter-counts) are files on disk (data/bible/), not database tables --
-- copied directly from the Young Adults app, since that content never
-- changes per-user. This migration only covers what's personal to each
-- signed-in user: highlights, notes, and tags on specific verses.
--
-- Unlike the Young Adults app (which keyed this to an anonymous device_id
-- since it had no real accounts), this version keys everything to a real
-- users.id -- consistent with the rest of the Hub's auth model.

create table if not exists bible_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  book text not null,
  chapter integer not null,
  verse_start integer not null,
  verse_end integer not null,
  start_pos integer not null,
  end_pos integer not null,
  color text not null default 'yellow',
  created_at timestamptz not null default now()
);

create index if not exists bible_highlights_lookup on bible_highlights (user_id, book, chapter);

create table if not exists bible_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  book text not null,
  chapter integer not null,
  verse_start integer not null,
  verse_end integer not null,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book, chapter, verse_start, verse_end)
);

create index if not exists bible_notes_lookup on bible_notes (user_id, book, chapter);

create table if not exists bible_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  book text not null,
  chapter integer not null,
  verse_start integer not null,
  verse_end integer not null,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (user_id, book, chapter, verse_start, verse_end, tag)
);

create index if not exists bible_tags_lookup on bible_tags (user_id, book, chapter);

alter table bible_highlights enable row level security;
alter table bible_notes enable row level security;
alter table bible_tags enable row level security;
