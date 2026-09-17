-- NHAG Church Hub — Direct Messages (bolt-on, per-group opt-in)
--
-- Lets a member start a private thread with one or more of that group's
-- leaders. Per Cam's decision this is a SEPARATE bolt-on from Group Chat
-- (feature key "direct_messages"), member-initiated only -- a leader
-- can reply within a thread but doesn't start new ones to members here.
--
-- A thread's identity is its exact set of participants within one group:
-- messaging Leader A alone, and later messaging Leader A + Leader B
-- together, are two different threads (Cam's explicit call), so nothing
-- here deduplicates across different participant sets.

create table if not exists group_dm_threads (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  initiator_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_dm_threads_group on group_dm_threads(group_id);

-- Participants: the initiator plus whichever leader(s) they picked. Reusing
-- an existing thread means finding one whose participant set (this table)
-- exactly matches -- resolved in application code, not a DB constraint,
-- since "exact set match" isn't a simple unique index.
create table if not exists group_dm_participants (
  thread_id uuid not null references group_dm_threads(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  muted boolean not null default false,
  last_read_at timestamptz,
  primary key (thread_id, user_id)
);

create index if not exists idx_dm_participants_user on group_dm_participants(user_id);

create table if not exists group_dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references group_dm_threads(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_dm_messages_thread on group_dm_messages(thread_id, created_at);

alter table group_dm_threads enable row level security;
alter table group_dm_participants enable row level security;
alter table group_dm_messages enable row level security;
