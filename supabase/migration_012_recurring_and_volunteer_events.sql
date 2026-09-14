-- NHAG Church Hub — Recurring events & volunteer sign-ups
--
-- Rather than storing an abstract recurrence rule and computing
-- occurrences at read-time, a "repeating" event generates real,
-- independent rows upfront (one per occurrence) -- each fully editable,
-- deletable, and RSVP-able on its own, with zero changes needed to any
-- existing event/RSVP code. recurrence_group_id just tags rows created
-- together from the same series, so "delete this and all future
-- occurrences" is possible without a separate recurrence table.

alter table global_events add column if not exists recurrence_group_id uuid;
alter table group_events add column if not exists recurrence_group_id uuid;

create index if not exists global_events_recurrence_idx on global_events (recurrence_group_id);
create index if not exists group_events_recurrence_idx on group_events (recurrence_group_id);

-- NHAG Church Hub — Volunteer sign-ups
--
-- An opt-in bolt-on when creating an event, not a separate feature to
-- turn on per-ministry -- volunteers_needed is just null unless the
-- creator checks the box and sets a number. A signup table mirrors the
-- RSVP table pattern exactly (one row per person per event).

alter table global_events add column if not exists volunteers_needed integer;
alter table group_events add column if not exists volunteers_needed integer;

create table if not exists global_event_volunteers (
  event_id uuid not null references global_events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists group_event_volunteers (
  event_id uuid not null references group_events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table global_event_volunteers enable row level security;
alter table group_event_volunteers enable row level security;
