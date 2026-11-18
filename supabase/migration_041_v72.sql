-- v72: onboarding (setup walkthrough + "Finish setting up" checklist).
-- users.onboarding remembers per ACCOUNT (not per phone -- on iPhone, Safari
-- and the installed app keep separate storage) which setup items someone
-- said "No thanks" to, and that they've been through the walkthrough:
--   { "declined": ["photo", ...], "walkthrough_done": true }
-- Safe to run twice.
alter table users add column if not exists onboarding jsonb not null default '{}'::jsonb;
