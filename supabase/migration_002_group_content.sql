-- NHAG Church Hub — Phase 3: generic group module
-- One News/Events/Prayer model, shared by every group (Choir, each Sunday
-- School class). Run after schema.sql and migration_001_global_content.sql.

create table if not exists group_news (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  body text not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists group_news_group_idx on group_news (group_id, created_at desc);

create table if not exists group_news_replies (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references group_news(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists group_news_replies_news_idx on group_news_replies (news_id, created_at);

create table if not exists group_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  event_date date not null,
  event_time text,
  location text,
  notes text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists group_events_group_idx on group_events (group_id, event_date);

create table if not exists group_events_replies (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references group_events(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists group_events_replies_event_idx on group_events_replies (event_id, created_at);

-- No replies table for prayer -- per the project's decision, prayer
-- requests never have replies, ever. is_anonymous controls display only:
-- the submitter is still recorded (for moderation / the submitter's own
-- ability to delete their own request), just not shown to other members
-- when true.
create table if not exists group_prayer (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  body text not null,
  is_anonymous boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists group_prayer_group_idx on group_prayer (group_id, created_at desc);

alter table group_news enable row level security;
alter table group_news_replies enable row level security;
alter table group_events enable row level security;
alter table group_events_replies enable row level security;
alter table group_prayer enable row level security;

-- group_promotion_requests already exists from Foundation's schema.sql --
-- this is where it becomes functional: source_type='news' now has a real
-- table (group_news) to point at.
