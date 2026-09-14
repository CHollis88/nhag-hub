-- NHAG Church Hub — Sermon speaker
-- Who preached, since it varies (guest speakers, associate pastors, etc.)
-- and isn't always the same person.

alter table sermons add column if not exists speaker text;
