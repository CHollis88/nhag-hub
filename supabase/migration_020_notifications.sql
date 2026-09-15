-- NHAG Church Hub — In-app Notifications
--
-- Push notifications (web-push) are ephemeral -- if you miss it, or never
-- enabled push on this device, it's gone. This gives every person a
-- persistent, in-app record of what they were notified about, so there's
-- an actual place to look ("Notifications") rather than only whatever
-- happened to reach a device via push at the moment it was sent.
--
-- One row per recipient (fanned out at send time, same as push
-- subscriptions already are) rather than one row per broadcast with a
-- separate read-tracking table -- simpler, and this table is naturally
-- bounded per person by how much actually gets sent to them.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  body text,
  url text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
