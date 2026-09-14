-- NHAG Church Hub — Prayer supporters
--
-- Mirrors the Young Adults / Choir apps' own "I'm praying" pattern
-- exactly: a denormalized pray_count column for fast reads (no COUNT
-- query needed on every list load), kept in sync by the toggle route,
-- plus a join table tracking who has it marked so tapping again removes
-- it and decrements the count -- not a one-way running total.

alter table group_prayer add column if not exists pray_count integer not null default 0;

create table if not exists group_prayer_supporters (
  prayer_id uuid not null references group_prayer(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (prayer_id, user_id)
);

alter table group_prayer_supporters enable row level security;
