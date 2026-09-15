-- NHAG Church Hub — Optional RSVP
-- Same reasoning as optional replies (migration_021): not every event
-- needs a Yes/Maybe/No headcount. Defaults to true so every existing
-- event keeps working exactly as it already does; the creator can turn
-- it off for a specific event going forward.

alter table global_events add column if not exists allow_rsvp boolean not null default true;
alter table group_events add column if not exists allow_rsvp boolean not null default true;
