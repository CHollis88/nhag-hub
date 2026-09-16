-- NHAG Church Hub — Ministry hiding
--
-- Lets a Church Admin hide a ministry. Per Cam's explicit decision, this
-- is NOT a single fixed behavior: the admin chooses, per ministry,
-- whether hiding also cuts off existing members' access or only removes
-- it from Directory/discovery for people not already in it.
--
--   hidden                 -- if true, the group is excluded from
--                             /api/groups (Directory, Home's "other
--                             ministries" browse list) for anyone not
--                             already an active member of it
--   hide_restricts_access  -- only meaningful when hidden = true. If
--                             true, existing active members also lose
--                             access (effectively disabled for
--                             everyone). If false (the default),
--                             existing members keep full access; only
--                             new discovery/joining is blocked.

alter table groups add column if not exists hidden boolean not null default false;
alter table groups add column if not exists hide_restricts_access boolean not null default false;
