-- NHAG Church Hub — Push notifications
--
-- Triggers, per the project's decisions:
--   Global scope (group_id IS NULL): any church-wide News or Event post
--   Group scope: any News, Event, or Prayer post in that group, PLUS
--     (for groups with the reading_plan_journal feature) a daily 9am
--     reading reminder, PLUS (for groups with songs_setlists) a new
--     setlist being added
--
-- One subscription row per browser/device (a person can have several --
-- phone + laptop, etc.), keyed to a real user_id instead of the old app's
-- anonymous device_id.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

-- Global and per-group preferences are separate tables rather than one
-- table with a nullable group_id -- Postgres doesn't treat multiple NULLs
-- as a uniqueness conflict, which would have let someone end up with two
-- contradictory "global" rows. This way each is unambiguous.

create table if not exists global_notification_prefs (
  user_id uuid primary key references users(id) on delete cascade,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists group_notification_prefs (
  user_id uuid not null references users(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

-- No row in either table means "enabled" (opt-out model, not opt-in) --
-- see lib/notify.js for where that default is applied. This keeps new
-- members getting notified about their group without an extra setup step.

alter table push_subscriptions enable row level security;
alter table global_notification_prefs enable row level security;
alter table group_notification_prefs enable row level security;
