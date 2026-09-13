-- NHAG Church Hub — News categorization
--
-- Church-wide News gets a category so admin can distinguish general
-- Announcements from a Message from the Pastor (or anything else added
-- later) -- same table, just a label.
--
-- Group News gets the Young Adults app's Announcement/Class/Discuss
-- pattern, applied to every ministry via the shared generic module:
--   'announcement' -- plain post, no replies
--   'class'        -- class notes, no replies
--   'discuss'      -- open discussion, members can reply (existing
--                     group_news_replies table already supports this)
-- All three are leader/admin-only to CREATE; only 'discuss' posts open
-- up replies to every member -- enforced at the application layer, not
-- the database, since it's a display/permission rule, not a structural
-- one.

alter table global_news add column if not exists category text not null default 'announcement'
  check (category in ('announcement', 'pastor_message'));

alter table group_news add column if not exists kind text not null default 'announcement'
  check (kind in ('announcement', 'class', 'discuss'));
