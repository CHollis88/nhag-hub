-- NHAG Church Hub -- v71 migration 036: deleting accounts + admin notifications switch
--
-- Run after migration_035, BEFORE deploying v71. Safe to run more than once;
-- nothing here changes or removes existing data.
--
--   1. Three columns that would have BLOCKED deleting an account now let the
--      person's name go blank instead (their content stays).
--   2. Group chat messages survive their sender ("Former member").
--   3. users.admin_notifications_enabled -- turn OFF the admin-duty
--      notifications (join requests, feedback, promotion requests) for one admin.

-- ---------------------------------------------------------------------------
-- 1 + 2. Author columns: on delete SET NULL
-- ---------------------------------------------------------------------------
-- Before this, a person who had ever posted a sermon or reviewed a promotion
-- request could not be deleted at all (the database refused). And a deleted
-- person's group-chat messages would have been erased, leaving holes in
-- everyone else's conversation. Now the row stays and the author is blank;
-- the app shows "Former member".
--
-- (Their PRIVATE data still goes with them: direct messages, journal, notes,
-- highlights, RSVPs, push subscriptions, notifications, sessions -- those keep
-- ON DELETE CASCADE, unchanged.)
--
-- The constraint names differ between installs, so find them instead of
-- guessing, drop whatever foreign key is on that column, and add the new one.
do $$
declare
  target record;
  con record;
begin
  for target in
    select * from (values
      ('group_chat_messages', 'sender_id'),
      ('sermons', 'created_by'),
      ('group_promotion_requests', 'reviewed_by')
    ) as v(tbl, col)
  loop
    for con in
      select c.conname
        from pg_constraint c
        join pg_class cl on cl.oid = c.conrelid
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
       where c.contype = 'f'
         and cl.relname = target.tbl
         and a.attname = target.col
         and c.confrelid = 'users'::regclass
    loop
      execute format('alter table %I drop constraint %I', target.tbl, con.conname);
    end loop;

    execute format(
      'alter table %I add constraint %I foreign key (%I) references users(id) on delete set null',
      target.tbl, target.tbl || '_' || target.col || '_fkey', target.col
    );
  end loop;
end $$;

alter table group_chat_messages alter column sender_id drop not null;

-- ---------------------------------------------------------------------------
-- 3. Admin notifications switch
-- ---------------------------------------------------------------------------
-- Default ON, so nobody's notifications change until it is turned off. It
-- only affects the admin-duty notifications; the Needs attention list and its
-- badge always show, and church-wide announcements follow the existing
-- church-wide setting.
alter table users add column if not exists admin_notifications_enabled boolean not null default true;

notify pgrst, 'reload schema';
