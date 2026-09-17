-- NHAG Church Hub — Per-user ministry hiding
--
-- Separate from the group-level `hidden` flag (migration_023), which is
-- global (everyone or nobody-not-already-in-it). This lets a Church Admin
-- block ONE specific person from ONE specific ministry -- e.g. a member
-- who shouldn't be discovering or joining Kids, Youth, Sound, or Security.
-- Per Cam's decision: applying this to a user who's already an active
-- member of that group also removes their membership (enforced in
-- application code at write time, not here) -- this table only records
-- which (user, group) pairs are blocked from here on.

create table if not exists user_hidden_groups (
  user_id uuid not null references users(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  hidden_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

create index if not exists idx_user_hidden_groups_user on user_hidden_groups(user_id);

alter table user_hidden_groups enable row level security;
