-- NHAG Church Hub — Optional event replies
-- Not every event needs an open discussion thread. Defaults to true so
-- every existing event keeps working exactly as it already does; the
-- creator can turn it off for a specific event going forward.

alter table group_events add column if not exists allow_replies boolean not null default true;
