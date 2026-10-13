-- v71_16: Prayer becomes a bolt-on module ("prayer" in groups.features)
-- instead of being on for every ministry.
--
-- To keep anyone from losing something they use, every ministry that already
-- has at least one prayer request keeps Prayer turned on. Ministries with no
-- prayer requests start with it off; a leader can switch it on in
-- Ministry settings > Bolt-on modules. Nothing is deleted either way.
-- Idempotent: safe to run twice.
update public.groups g
set features = array_append(g.features, 'prayer')
where not ('prayer' = any(g.features))
  and exists (select 1 from public.group_prayer p where p.group_id = g.id);
