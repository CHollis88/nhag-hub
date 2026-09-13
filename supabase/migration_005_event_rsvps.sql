-- NHAG Church Hub — Event RSVPs
-- Applies to both church-wide events (global_events) and group-scoped
-- events (group_events) -- RSVP is core to what makes an event useful,
-- not optional polish, so both get it rather than just one.

create table if not exists global_event_rsvps (
  event_id uuid not null references global_events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists group_event_rsvps (
  event_id uuid not null references group_events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table global_event_rsvps enable row level security;
alter table group_event_rsvps enable row level security;
