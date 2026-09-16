-- NHAG Church Hub — Leader-only posts
--
-- Per-ministry: a new 'leader' kind for group_news, alongside the
-- existing announcement/class/discuss. POST authorization is unchanged
-- (already leader/admin-only via canManageGroup -- see
-- app/api/groups/[id]/news/route.js), so any leader of that group can
-- already create one; what's new is the READ-side restriction: a
-- 'leader' post is filtered out of the GET response for anyone who
-- isn't a leader/admin of that specific group (enforced at the
-- application layer, same as how 'discuss' reply permission already
-- works -- see that route's comment).
--
-- Postgres auto-names an inline column CHECK added via ALTER TABLE ADD
-- COLUMN as `<table>_<column>_check`, which is what migration_010
-- created without an explicit name. Dropping and recreating it under
-- that same default name is how you add an allowed value to an existing
-- check constraint -- there's no ALTER CONSTRAINT for this in Postgres.
alter table group_news drop constraint if exists group_news_kind_check;
alter table group_news add constraint group_news_kind_check
  check (kind in ('announcement', 'class', 'discuss', 'leader'));

-- Church-wide: a separate `audience` column on global_news, orthogonal
-- to `category` (a pastor_message could in principle also be
-- leader-only, though that's not expected to come up). Unlike
-- 'leader'-kind group posts, POSTing a leaders-audience global post is a
-- NEW capability -- normal global_news posting stays admin-only per the
-- existing project decision (see that route's comment), but Cam
-- explicitly asked that "leaders-audience" posts be postable by any
-- leader, not just admins. Enforced in the route itself: audience =
-- 'everyone' still requires is_church_admin; audience = 'leaders' also
-- accepts any active group leader.
alter table global_news add column if not exists audience text not null default 'everyone'
  check (audience in ('everyone', 'leaders'));
