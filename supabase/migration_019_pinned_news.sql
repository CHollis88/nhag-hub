-- NHAG Church Hub — Pinned News
-- Everything currently sorts by date, so something meant to stay visible
-- for a while (e.g. "VBS registration open all month") gets buried under
-- newer day-to-day posts within days. Pinning keeps a post at the top
-- regardless of when it was posted, until unpinned.

alter table global_news add column if not exists pinned boolean not null default false;
alter table group_news add column if not exists pinned boolean not null default false;
