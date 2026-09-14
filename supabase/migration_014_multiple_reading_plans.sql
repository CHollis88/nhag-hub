-- NHAG Church Hub — Multiple reading plans
--
-- reading_progress/journal_entries were keyed by (user_id, day) alone,
-- assuming exactly one plan existed. Adding plan_id lets a user's
-- progress/journal on different plans coexist without colliding on the
-- same day numbers. Existing rows default to 'foundations' (the
-- original, only plan up to now), so nobody's existing progress or
-- journal entries are affected.

alter table reading_progress add column if not exists plan_id text not null default 'foundations';
alter table journal_entries add column if not exists plan_id text not null default 'foundations';

alter table reading_progress drop constraint if exists reading_progress_user_id_day_key;
alter table reading_progress add constraint reading_progress_user_id_plan_id_day_key unique (user_id, plan_id, day);

alter table journal_entries drop constraint if exists journal_entries_user_id_day_key;
alter table journal_entries add constraint journal_entries_user_id_plan_id_day_key unique (user_id, plan_id, day);

-- Which plan a user currently has selected. Defaults to the original
-- plan so nothing changes for anyone until they actively switch.
alter table users add column if not exists active_reading_plan text not null default 'foundations';
