-- NHAG Church Hub — Reading plan: locked vs. pickable per ministry
--
-- A ministry's own leader (or admin) decides: lock everyone onto one
-- plan together (e.g. for shared group discussion), or let each member
-- pick their own from the available plans. Default is unlocked (each
-- member picks their own) -- the group's own choice, not a global
-- setting, since different ministries may want different approaches.

alter table groups add column if not exists reading_plan_locked boolean not null default false;
alter table groups add column if not exists reading_plan_id text not null default 'foundations';

-- A member's own personal choice, used only when their group's reading
-- plan is NOT locked. Already exists from migration_014 as
-- active_reading_plan -- nothing to add there.
