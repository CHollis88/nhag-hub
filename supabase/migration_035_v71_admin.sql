-- NHAG Church Hub -- v71 migration 035: admin model
--
-- Run this (with migration_034) in the Supabase SQL editor BEFORE deploying
-- v71. Safe to run more than once; nothing here changes existing data.
--
--   1. sessions.admin_mode / pin_verified_at   ("Use Admin Privileges", PIN re-check)
--   2. users.pin_* counters + pin_attempt_*()   (PIN attempt limiting)
--   3. groups.archived_at                       (archive a ministry instead of deleting it)
--   4. admin_activity_log.meta                  (readable log lines, raw details expandable)
--   5. notifications.batch_* + notify_admins_join_request()  (one batched notification per admin)
--   6. Permissions: functions callable by the server (service role) only

-- ---------------------------------------------------------------------------
-- 1. Per-session admin mode + "recently verified PIN"
-- ---------------------------------------------------------------------------
-- admin_mode is per SESSION (per device): turning admin privileges off on
-- your phone doesn't change your laptop. It defaults to true, so every
-- existing session and every new sign-in keeps working exactly as before.
-- The is_church_admin ROLE on users is never touched by this switch; the
-- server just treats a session with admin_mode = false as a regular member.
alter table sessions add column if not exists admin_mode boolean not null default true;

-- Set when the person re-enters their PIN for a high-impact action (grant /
-- remove admin, permanently delete a ministry, sign someone out everywhere).
-- The app treats it as valid for a few minutes only.
alter table sessions add column if not exists pin_verified_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. PIN attempt limiting
-- ---------------------------------------------------------------------------
-- A 4-8 digit PIN can be guessed if attempts are free. Every PIN re-check
-- counts here, IN THE DATABASE (an in-memory counter is useless on
-- serverless: each request may land on a different instance).
alter table users add column if not exists pin_fail_count integer not null default 0;
alter table users add column if not exists pin_locked_until timestamptz;
alter table users add column if not exists pin_last_attempt_at timestamptz;

-- Called BEFORE the PIN is compared. The attempt is counted first, under a
-- row lock, so a burst of parallel guesses can't all slip through before
-- the lock lands. p_max attempts are allowed; the p_max-th one locks the
-- account for p_lock_minutes for anyone who then keeps guessing.
-- Failures older than p_decay_minutes are forgotten.
--
-- Returns {"allowed": bool, "locked_until": ts|null, "attempts_left": int}.
create or replace function pin_attempt_begin(
  p_user_id uuid,
  p_max integer default 5,
  p_lock_minutes integer default 15,
  p_decay_minutes integer default 60
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
  v_locked timestamptz;
  v_last timestamptz;
begin
  select pin_fail_count, pin_locked_until, pin_last_attempt_at
    into v_count, v_locked, v_last
    from users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('allowed', false, 'locked_until', null, 'attempts_left', 0);
  end if;

  if v_locked is not null and v_locked > now() then
    return jsonb_build_object('allowed', false, 'locked_until', v_locked, 'attempts_left', 0);
  end if;

  -- A lock that has expired, or old failures, start a fresh count.
  if v_locked is not null or v_last is null or v_last < now() - make_interval(mins => p_decay_minutes) then
    v_count := 0;
    v_locked := null;
  end if;

  v_count := v_count + 1;
  if v_count >= p_max then
    v_locked := now() + make_interval(mins => p_lock_minutes);
  end if;

  update users
     set pin_fail_count = v_count, pin_locked_until = v_locked, pin_last_attempt_at = now()
   where id = p_user_id;

  return jsonb_build_object(
    'allowed', true,
    'locked_until', v_locked,
    'attempts_left', greatest(p_max - v_count, 0)
  );
end;
$$;

-- Called when the PIN was RIGHT: forgives earlier misses and lifts any lock
-- that the successful attempt itself just triggered.
create or replace function pin_attempt_success(p_user_id uuid) returns void
language sql
set search_path = public
as $$
  update users
     set pin_fail_count = 0, pin_locked_until = null, pin_last_attempt_at = null
   where id = p_user_id;
$$;

-- ---------------------------------------------------------------------------
-- 3. Archive a ministry
-- ---------------------------------------------------------------------------
-- Archived = hidden from members and the directory, everything kept, and an
-- admin can restore it. Permanent delete stays a separate, warned action.
alter table groups add column if not exists archived_at timestamptz;
create index if not exists idx_groups_archived on groups (archived_at) where archived_at is not null;

-- ---------------------------------------------------------------------------
-- 4. Activity log: structured details behind each readable line
-- ---------------------------------------------------------------------------
alter table admin_activity_log add column if not exists meta jsonb;

-- ---------------------------------------------------------------------------
-- 5. One batched notification per admin for join requests
-- ---------------------------------------------------------------------------
-- Five people asking to join within a few minutes used to be five separate
-- pushes to every admin. Now the first one notifies; the ones that follow,
-- while that notification is still unread and recent, update it in place
-- ("5 new join requests across 3 ministries") without another push.
alter table notifications add column if not exists batch_kind text;
alter table notifications add column if not exists batch_count integer;
alter table notifications add column if not exists batch_data jsonb;
alter table notifications add column if not exists batch_updated_at timestamptz;
create index if not exists idx_notifications_open_batch
  on notifications (user_id, batch_kind)
  where read = false and batch_kind is not null;

-- p_recipients are the admins to notify -- the caller has ALREADY removed the
-- person who performed the action (nobody is notified of their own action).
-- Returns {"push_to": [user ids that should get a real push]}: only admins
-- whose notification was newly created. Merged updates don't push again.
create or replace function notify_admins_join_request(
  p_recipients uuid[],
  p_group_id uuid,
  p_single_body text,
  p_single_url text,
  p_window_minutes integer default 10
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid;
  v_row record;
  v_groups jsonb;
  v_count integer;
  v_gcount integer;
  v_push uuid[] := '{}';
begin
  if p_recipients is null then
    return jsonb_build_object('push_to', '[]'::jsonb);
  end if;

  foreach v_uid in array p_recipients loop
    select id, batch_count, batch_data into v_row
      from notifications
     where user_id = v_uid
       and batch_kind = 'join_request'
       and read = false
       and batch_updated_at > now() - make_interval(mins => p_window_minutes)
     order by batch_updated_at desc
     limit 1
     for update;

    if found then
      v_groups := coalesce(v_row.batch_data -> 'groups', '[]'::jsonb);
      if not (v_groups @> to_jsonb(p_group_id::text)) then
        v_groups := v_groups || to_jsonb(p_group_id::text);
      end if;
      v_count := coalesce(v_row.batch_count, 1) + 1;
      v_gcount := jsonb_array_length(v_groups);

      update notifications
         set batch_count = v_count,
             batch_data = jsonb_build_object('groups', v_groups),
             batch_updated_at = now(),
             created_at = now(),            -- surfaces it at the top again
             title = 'Join Requests',
             body = case when v_gcount = 1
                      then format('%s new join requests', v_count)
                      else format('%s new join requests across %s ministries', v_count, v_gcount)
                    end,
             url = case when v_gcount = 1 then p_single_url else '/?admin=toolbox' end
       where id = v_row.id;
    else
      insert into notifications (user_id, title, body, url, batch_kind, batch_count, batch_data, batch_updated_at)
      values (v_uid, 'Join Request', p_single_body, p_single_url, 'join_request', 1,
              jsonb_build_object('groups', jsonb_build_array(p_group_id::text)), now());
      v_push := v_push || v_uid;
    end if;
  end loop;

  return jsonb_build_object('push_to', to_jsonb(v_push));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Permissions: only the server (service role) may call these
-- ---------------------------------------------------------------------------
revoke all on function pin_attempt_begin(uuid, integer, integer, integer) from public, anon, authenticated;
revoke all on function pin_attempt_success(uuid) from public, anon, authenticated;
revoke all on function notify_admins_join_request(uuid[], uuid, text, text, integer) from public, anon, authenticated;

grant execute on function pin_attempt_begin(uuid, integer, integer, integer) to service_role;
grant execute on function pin_attempt_success(uuid) to service_role;
grant execute on function notify_admins_join_request(uuid[], uuid, text, text, integer) to service_role;

notify pgrst, 'reload schema';
