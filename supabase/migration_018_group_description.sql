-- NHAG Church Hub — Ministry description
-- A short "what is this ministry" blurb, shown to people considering
-- joining -- unlike name/icon/color (which just identify a ministry),
-- this actually explains what it's for. Same editing authority as the
-- rest of a ministry's appearance (its own leader or admin).

alter table groups add column if not exists description text;
