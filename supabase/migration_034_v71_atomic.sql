-- NHAG Church Hub -- v71 migration 034: atomic operations
--
-- Run this (with migration_035) in the Supabase SQL editor BEFORE deploying
-- v71. Safe to run more than once. Nothing here changes existing data
-- except stamping a canonical key on existing DM threads (section 1).
--
-- Why: several operations were done as several separate requests from the
-- server (count-then-insert, update-header-then-delete-all-then-re-add,
-- find-thread-then-create-thread). Any failure or concurrent request in
-- the middle left half-done or duplicated data. Each of these is now ONE
-- database function, i.e. one transaction: it fully happens or it doesn't.
--
--   1. DM threads:      participant_key + unique index, create_dm_thread()
--   2. Volunteers:      volunteer_signup(), global_volunteer_signup()
--   3. Prayer:          toggle_prayer()
--   4. Setlists:        save_setlist(), save_program_setlist()
--   5. Permissions:     functions callable by the server (service role) only
--
-- The app talks to Postgres with the service-role key, which bypasses row
-- level security; these functions run as the caller (SECURITY INVOKER) and
-- are additionally locked so the public anon/authenticated roles cannot
-- call them through the REST API even if someone obtains the anon key.

-- ---------------------------------------------------------------------------
-- 1. Direct-message threads: one thread per exact participant set
-- ---------------------------------------------------------------------------
-- A thread's identity is its exact set of participants within one group.
-- participant_key is that set as a canonical string (user IDs sorted,
-- comma-joined); a unique index on (group_id, participant_key) makes a
-- duplicate thread impossible even if two requests race.
alter table group_dm_threads add column if not exists participant_key text;

-- Stamp existing threads. If the same participant set already has more than
-- one thread (possible from the old find-then-create race), only the OLDEST
-- gets the key; later duplicates keep a NULL key, which the unique index
-- ignores. No thread and no message is merged or deleted -- both stay
-- fully readable by their participants. New conversations reuse the oldest.
with keys as (
  select t.id, t.group_id, t.created_at,
         string_agg(p.user_id::text, ',' order by p.user_id) as k
  from group_dm_threads t
  join group_dm_participants p on p.thread_id = t.id
  where t.participant_key is null
  group by t.id, t.group_id, t.created_at
), ranked as (
  select id, k,
         row_number() over (partition by group_id, k order by created_at, id) as rn
  from keys
)
update group_dm_threads t
   set participant_key = r.k
  from ranked r
 where t.id = r.id
   and r.rn = 1
   -- don't collide with a key that's already taken (re-run safety)
   and not exists (
     select 1 from group_dm_threads o
      where o.group_id = t.group_id and o.participant_key = r.k and o.id <> t.id
   );

create unique index if not exists idx_dm_threads_participant_key
  on group_dm_threads (group_id, participant_key)
  where participant_key is not null;

-- Finds the thread for exactly {initiator + participants} in this group, or
-- creates it (thread + all participant rows in one transaction).
-- Returns {"thread_id": <uuid>, "existing": <bool>}.
-- Who is ALLOWED to message whom stays in the API route (it needs the
-- session's membership info); this function only guarantees the shape.
create or replace function create_dm_thread(
  p_group_id uuid,
  p_initiator_id uuid,
  p_participant_ids uuid[]
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_ids uuid[];
  v_key text;
  v_thread uuid;
begin
  select array_agg(distinct u order by u)
    into v_ids
    from unnest(array_append(coalesce(p_participant_ids, '{}'::uuid[]), p_initiator_id)) as u
   where u is not null;

  if v_ids is null or array_length(v_ids, 1) < 2 then
    raise exception 'dm_need_participant' using errcode = 'NH001';
  end if;

  select string_agg(u::text, ',' order by u) into v_key from unnest(v_ids) as u;

  -- Serialize concurrent creators of the SAME participant set.
  perform pg_advisory_xact_lock(hashtextextended(p_group_id::text || ':' || v_key, 0));

  select id into v_thread
    from group_dm_threads
   where group_id = p_group_id and participant_key = v_key;
  if found then
    return jsonb_build_object('thread_id', v_thread, 'existing', true);
  end if;

  begin
    insert into group_dm_threads (group_id, initiator_id, participant_key)
    values (p_group_id, p_initiator_id, v_key)
    returning id into v_thread;

    insert into group_dm_participants (thread_id, user_id)
    select v_thread, u from unnest(v_ids) as u;
  exception when unique_violation then
    -- Backstop: another transaction created it first. The inner block's
    -- work is rolled back; hand back the winner.
    select id into v_thread
      from group_dm_threads
     where group_id = p_group_id and participant_key = v_key;
    if v_thread is null then
      raise;
    end if;
    return jsonb_build_object('thread_id', v_thread, 'existing', true);
  end;

  return jsonb_build_object('thread_id', v_thread, 'existing', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Volunteer sign-up: capacity checked under a row lock
-- ---------------------------------------------------------------------------
-- The old route counted sign-ups, then inserted -- two people tapping at the
-- same moment could both pass the count and overbook the sheet. Now the
-- event row is locked (FOR UPDATE) for the count + insert, so concurrent
-- sign-ups for one event take turns.
--
-- Returns {"status": "ok" | "full" | "already" | "closed" | "not_found",
--          "count": <sign-ups after this call>}.
--   closed    = the event isn't taking volunteer sign-ups
--   not_found = no such event (or it isn't in that group)
create or replace function volunteer_signup(
  p_event_id uuid,
  p_user_id uuid,
  p_group_id uuid
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_needed integer;
  v_count integer;
begin
  select volunteers_needed into v_needed
    from group_events
   where id = p_event_id and group_id = p_group_id
   for update;
  if not found then
    return jsonb_build_object('status', 'not_found', 'count', 0);
  end if;
  if v_needed is null or v_needed <= 0 then
    return jsonb_build_object('status', 'closed', 'count', 0);
  end if;

  select count(*) into v_count from group_event_volunteers where event_id = p_event_id;

  if exists (select 1 from group_event_volunteers where event_id = p_event_id and user_id = p_user_id) then
    return jsonb_build_object('status', 'already', 'count', v_count);
  end if;
  if v_count >= v_needed then
    return jsonb_build_object('status', 'full', 'count', v_count);
  end if;

  insert into group_event_volunteers (event_id, user_id) values (p_event_id, p_user_id);
  return jsonb_build_object('status', 'ok', 'count', v_count + 1);
end;
$$;

-- Same, for church-wide events (global_events has the identical race).
create or replace function global_volunteer_signup(
  p_event_id uuid,
  p_user_id uuid
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_needed integer;
  v_count integer;
begin
  select volunteers_needed into v_needed
    from global_events
   where id = p_event_id
   for update;
  if not found then
    return jsonb_build_object('status', 'not_found', 'count', 0);
  end if;
  if v_needed is null or v_needed <= 0 then
    return jsonb_build_object('status', 'closed', 'count', 0);
  end if;

  select count(*) into v_count from global_event_volunteers where event_id = p_event_id;

  if exists (select 1 from global_event_volunteers where event_id = p_event_id and user_id = p_user_id) then
    return jsonb_build_object('status', 'already', 'count', v_count);
  end if;
  if v_count >= v_needed then
    return jsonb_build_object('status', 'full', 'count', v_count);
  end if;

  insert into global_event_volunteers (event_id, user_id) values (p_event_id, p_user_id);
  return jsonb_build_object('status', 'ok', 'count', v_count + 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Prayer: "I'm praying" toggle with an atomic count
-- ---------------------------------------------------------------------------
-- Toggles the caller's support and moves pray_count by exactly one, in one
-- transaction, with the prayer row locked so two people tapping at once
-- can't lose an update. The count moves RELATIVELY (+1 / -1), it is not
-- recomputed from group_prayer_supporters: pray_count was originally
-- mirrored from the older Young Adults / Choir apps (see migration_013),
-- so it may legitimately be higher than the supporter rows, and a
-- recompute would silently erase that history.
--
-- Returns {"status": "ok" | "not_found", "i_prayed": bool,
--          "pray_count": int, "created_by": uuid|null}.
-- created_by lets the route notify the author only on a new "praying".
create or replace function toggle_prayer(
  p_prayer_id uuid,
  p_group_id uuid,
  p_user_id uuid
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
  v_created_by uuid;
  v_removed integer;
  v_praying boolean;
begin
  select pray_count, created_by into v_count, v_created_by
    from group_prayer
   where id = p_prayer_id and group_id = p_group_id
   for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  delete from group_prayer_supporters where prayer_id = p_prayer_id and user_id = p_user_id;
  get diagnostics v_removed = row_count;

  if v_removed > 0 then
    v_praying := false;
    v_count := greatest(0, coalesce(v_count, 0) - 1);
  else
    insert into group_prayer_supporters (prayer_id, user_id)
    values (p_prayer_id, p_user_id)
    on conflict do nothing;
    v_praying := true;
    v_count := coalesce(v_count, 0) + 1;
  end if;

  update group_prayer set pray_count = v_count where id = p_prayer_id;

  return jsonb_build_object(
    'status', 'ok',
    'i_prayed', v_praying,
    'pray_count', v_count,
    'created_by', v_created_by
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Setlists: header + song list saved as one unit
-- ---------------------------------------------------------------------------
-- The old edit flow was: update the header, delete every song row one by
-- one, re-add each song one by one -- 2 + 2N requests. A failure partway
-- left the setlist half-empty. These replace the header and the whole song
-- list in ONE transaction; any error rolls everything back, leaving the
-- setlist exactly as it was.
--
-- p_setlist_id NULL  = create a new setlist.
-- p_header           = {"service_date": "YYYY-MM-DD", "service": "AM"|"PM"|"CP"}
-- p_songs            = [{"song_id": <uuid>, "note": <text|null>}, ...]  (array order = position)
-- The parent id (group / program) is required so the database itself
-- enforces that the setlist AND every song belong to that parent.
--
-- Returns {"status": "ok", "setlist_id": <uuid>} or {"status": "not_found"}.
-- Raises (SQLSTATE NH002) 'setlist_invalid' for a bad header/song list and
-- (NH003) 'setlist_song_not_found' for a song outside the parent's library.
create or replace function save_setlist(
  p_group_id uuid,
  p_setlist_id uuid,
  p_header jsonb,
  p_songs jsonb
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_date date;
  v_service text;
  v_entry jsonb;
  v_song uuid;
  v_pos integer := 0;
begin
  begin
    v_date := nullif(p_header->>'service_date', '')::date;
  exception when others then
    raise exception 'setlist_invalid' using errcode = 'NH002';
  end;
  v_service := p_header->>'service';
  if v_date is null or v_service is null or v_service not in ('AM', 'PM', 'CP') then
    raise exception 'setlist_invalid' using errcode = 'NH002';
  end if;

  if p_songs is null then p_songs := '[]'::jsonb; end if;
  if jsonb_typeof(p_songs) <> 'array' then
    raise exception 'setlist_invalid' using errcode = 'NH002';
  end if;

  if p_setlist_id is null then
    insert into group_setlists (group_id, service_date, service)
    values (p_group_id, v_date, v_service)
    returning id into v_id;
  else
    update group_setlists
       set service_date = v_date, service = v_service, updated_at = now()
     where id = p_setlist_id and group_id = p_group_id
    returning id into v_id;
    if v_id is null then
      return jsonb_build_object('status', 'not_found');
    end if;
    delete from group_setlist_songs where setlist_id = v_id;
  end if;

  for v_entry in select value from jsonb_array_elements(p_songs) loop
    begin
      v_song := (v_entry->>'song_id')::uuid;
    exception when others then
      raise exception 'setlist_invalid' using errcode = 'NH002';
    end;
    if v_song is null or not exists (select 1 from group_songs where id = v_song and group_id = p_group_id) then
      raise exception 'setlist_song_not_found' using errcode = 'NH003';
    end if;
    insert into group_setlist_songs (setlist_id, song_id, note, position)
    values (v_id, v_song, nullif(v_entry->>'note', ''), v_pos);
    v_pos := v_pos + 1;
  end loop;

  return jsonb_build_object('status', 'ok', 'setlist_id', v_id);
end;
$$;

-- Same, for a program's own setlists (program_setlists / program_songs).
create or replace function save_program_setlist(
  p_program_id uuid,
  p_setlist_id uuid,
  p_header jsonb,
  p_songs jsonb
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_date date;
  v_service text;
  v_entry jsonb;
  v_song uuid;
  v_pos integer := 0;
begin
  begin
    v_date := nullif(p_header->>'service_date', '')::date;
  exception when others then
    raise exception 'setlist_invalid' using errcode = 'NH002';
  end;
  v_service := p_header->>'service';
  if v_date is null or v_service is null or v_service not in ('AM', 'PM', 'CP') then
    raise exception 'setlist_invalid' using errcode = 'NH002';
  end if;

  if p_songs is null then p_songs := '[]'::jsonb; end if;
  if jsonb_typeof(p_songs) <> 'array' then
    raise exception 'setlist_invalid' using errcode = 'NH002';
  end if;

  if p_setlist_id is null then
    insert into program_setlists (program_id, service_date, service)
    values (p_program_id, v_date, v_service)
    returning id into v_id;
  else
    update program_setlists
       set service_date = v_date, service = v_service, updated_at = now()
     where id = p_setlist_id and program_id = p_program_id
    returning id into v_id;
    if v_id is null then
      return jsonb_build_object('status', 'not_found');
    end if;
    delete from program_setlist_songs where setlist_id = v_id;
  end if;

  for v_entry in select value from jsonb_array_elements(p_songs) loop
    begin
      v_song := (v_entry->>'song_id')::uuid;
    exception when others then
      raise exception 'setlist_invalid' using errcode = 'NH002';
    end;
    if v_song is null or not exists (select 1 from program_songs where id = v_song and program_id = p_program_id) then
      raise exception 'setlist_song_not_found' using errcode = 'NH003';
    end if;
    insert into program_setlist_songs (setlist_id, song_id, note, position)
    values (v_id, v_song, nullif(v_entry->>'note', ''), v_pos);
    v_pos := v_pos + 1;
  end loop;

  return jsonb_build_object('status', 'ok', 'setlist_id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Permissions: only the server (service role) may call these
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE on new functions to everyone by default, and
-- Supabase exposes public functions over the REST API. Lock that down.
revoke all on function create_dm_thread(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function volunteer_signup(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function global_volunteer_signup(uuid, uuid) from public, anon, authenticated;
revoke all on function toggle_prayer(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function save_setlist(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function save_program_setlist(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;

grant execute on function create_dm_thread(uuid, uuid, uuid[]) to service_role;
grant execute on function volunteer_signup(uuid, uuid, uuid) to service_role;
grant execute on function global_volunteer_signup(uuid, uuid) to service_role;
grant execute on function toggle_prayer(uuid, uuid, uuid) to service_role;
grant execute on function save_setlist(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function save_program_setlist(uuid, uuid, jsonb, jsonb) to service_role;

-- After running, ask PostgREST to pick up the new functions immediately
-- (otherwise the API can take a moment to notice them):
notify pgrst, 'reload schema';
