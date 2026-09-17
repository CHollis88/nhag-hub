-- NHAG Church Hub — Group Chat (bolt-on, per-group opt-in)
--
-- Separate bolt-on from Direct Messages (feature key "group_chat"). Two
-- channels exist per group: "members" (everyone active in the group can
-- post and read) and "leaders" (only that group's own leaders/admins can
-- post and read) -- per Cam's decision to build both now rather than
-- leaders-only-only, so a ministry that wants an open members channel
-- later doesn't need new schema.

create table if not exists group_chat_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  channel text not null check (channel in ('members', 'leaders')),
  sender_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_group_chat_lookup on group_chat_messages(group_id, channel, created_at);

-- Per-user mute + read tracking, per group+channel (not per-message --
-- reading is tracked at the channel level, same idea as group_dm_participants).
create table if not exists group_chat_reads (
  group_id uuid not null references groups(id) on delete cascade,
  channel text not null check (channel in ('members', 'leaders')),
  user_id uuid not null references users(id) on delete cascade,
  muted boolean not null default false,
  last_read_at timestamptz,
  primary key (group_id, channel, user_id)
);

alter table group_chat_messages enable row level security;
alter table group_chat_reads enable row level security;
