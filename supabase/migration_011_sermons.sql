-- NHAG Church Hub — Sermons
--
-- A church-wide archive: a short synopsis plus a link out to wherever the
-- actual sermon lives (Facebook, YouTube, etc.) -- this app never hosts
-- or embeds the video/audio itself, just points to it.
--
-- Admin-only to post, same as the rest of church-wide content. Unlike
-- News/Events, sermons are NOT subject to the 30-day auto-delete cron --
-- this is meant to be a browsable archive over time, not transient
-- content.

create table if not exists sermons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  synopsis text not null,
  link_url text,
  sermon_date date,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sermons_date_idx on sermons (sermon_date desc, created_at desc);
