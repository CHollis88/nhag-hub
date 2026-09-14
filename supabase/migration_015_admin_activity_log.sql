-- NHAG Church Hub — Admin activity log
--
-- A record of admin-level actions (creating/deleting a ministry,
-- promoting/demoting someone's admin access, approving/rejecting a
-- promotion request) -- who did what and when, visible to admins in the
-- Toolbox. Purely a record: it doesn't change what anyone can do, just
-- makes admin actions traceable after the fact.

create table if not exists admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id) on delete set null,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_log_created_idx on admin_activity_log (created_at desc);
