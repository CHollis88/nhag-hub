-- NHAG Church Hub — Reading Plan + Journal (the "reading_plan_journal"
-- group feature, e.g. for a Young Adults-style group)
--
-- Like Bible highlights/notes/tags, this data is personal to each user --
-- it does not need a group_id, since a person's reading progress and
-- journal entries belong to them regardless of which group's nav exposes
-- the tab. The feature flag on the group (see schema.sql groups.features)
-- controls visibility only; the data itself is just user-scoped.
--
-- The reading plan's actual daily schedule (day -> passages) is static
-- content shipped in the app (data/plan.json), not a database table --
-- same pattern as the Bible text itself.

create table if not exists reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  day integer not null,
  prayed boolean not null default false,
  read boolean not null default false,
  meditated boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create index if not exists reading_progress_user_idx on reading_progress (user_id);

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  day integer not null,
  text text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create index if not exists journal_entries_user_idx on journal_entries (user_id);

alter table reading_progress enable row level security;
alter table journal_entries enable row level security;
