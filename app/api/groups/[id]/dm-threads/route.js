import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isActiveGroupMember, canManageGroup } from "@/lib/groupAuth";
import { withNoStore } from "@/lib/cacheHeaders";
import { rpcFailure } from "@/lib/rpc";

// Direct Messages (migration_026, feature key "direct_messages"). A
// regular member picks one or more of the group's own leaders and
// starts a thread; a leader or Church Admin can start one with anyone
// active in the group. A thread's identity is its exact participant
// set: messaging Leader A alone and later messaging Leader A + Leader B
// together are two different threads, never merged.

// Lists every DM thread in this group that I'm a participant of, newest
// activity first, with the other participants' names, an unread count,
// and my mute state for each.
export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();

  const { data: myRows, error: myRowsError } = await supabase
    .from("group_dm_participants")
    .select("thread_id, muted, last_read_at, group_dm_threads!inner(id, group_id, created_at)")
    .eq("user_id", user.id)
    .eq("group_dm_threads.group_id", groupId);

  if (myRowsError) return NextResponse.json({ error: myRowsError.message }, { status: 500 });
  if (!myRows?.length) return withNoStore({ threads: [] });

  const threadIds = myRows.map((r) => r.thread_id);

  const { data: allParticipants } = await supabase
    .from("group_dm_participants")
    .select("thread_id, user_id, users(display_name)")
    .in("thread_id", threadIds);

  const { data: lastMessages } = await supabase
    .from("group_dm_messages")
    .select("thread_id, body, created_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false });

  const lastMessageByThread = {};
  for (const m of lastMessages || []) {
    if (!lastMessageByThread[m.thread_id]) lastMessageByThread[m.thread_id] = m;
  }

  const { data: unreadCounts } = await supabase
    .from("group_dm_messages")
    .select("thread_id, created_at, sender_id")
    .in("thread_id", threadIds);

  const threads = myRows
    .map((row) => {
      const others = (allParticipants || [])
        .filter((p) => p.thread_id === row.thread_id && p.user_id !== user.id)
        .map((p) => p.users?.display_name)
        .filter(Boolean);
      const last = lastMessageByThread[row.thread_id];
      const unread = (unreadCounts || []).filter(
        (m) =>
          m.thread_id === row.thread_id &&
          m.sender_id !== user.id &&
          (!row.last_read_at || m.created_at > row.last_read_at)
      ).length;

      return {
        id: row.thread_id,
        participant_names: others,
        last_message: last ? { body: last.body, created_at: last.created_at } : null,
        muted: row.muted,
        unread_count: unread,
      };
    })
    .sort((a, b) => {
      const aTime = a.last_message?.created_at || "";
      const bTime = b.last_message?.created_at || "";
      return bTime.localeCompare(aTime);
    });

  return withNoStore({ threads });
}

// Starts a new thread, or returns an existing one with the exact same
// participant set (me + whoever I picked) if one already exists.
export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const { participant_ids } = await req.json();
  const chosenIds = Array.isArray(participant_ids) ? [...new Set(participant_ids)].filter((id) => id !== user.id) : [];
  if (!chosenIds.length) {
    return NextResponse.json({ error: "Pick at least one person to message." }, { status: 400 });
  }

  const supabase = supabaseServer();

  // A regular member can only message this group's leaders. A leader or
  // Church Admin can message anyone active in the group -- per Cam's
  // decision, a leader should be able to reach out to a member directly,
  // not just reply once a member messages them first.
  const isManager = await canManageGroup(user, groupId);
  const memberRowsQuery = supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("status", "active")
    .in("user_id", chosenIds);
  if (!isManager) memberRowsQuery.eq("role", "leader");

  const { data: eligibleRows } = await memberRowsQuery;

  if ((eligibleRows || []).length !== chosenIds.length) {
    return NextResponse.json(
      { error: isManager ? "One or more of those people aren't active in this group." : "You can only message this group's leaders." },
      { status: 400 }
    );
  }

  // v71 #11: find-or-create in ONE database call (create_dm_thread,
  // migration_034). A thread's identity is its canonical participant key
  // (sorted user IDs) with a unique index behind it, so two requests
  // racing to start the same conversation get the same thread, and the
  // thread and its participant rows are created in one transaction (the
  // old code could leave a thread with no participants if the second
  // insert failed).
  const { data: created, error: createError } = await supabase.rpc("create_dm_thread", {
    p_group_id: groupId,
    p_initiator_id: user.id,
    p_participant_ids: chosenIds,
  });
  if (createError) {
    return rpcFailure(createError, { NH001: { status: 400, message: "Pick at least one person to message." } });
  }

  return NextResponse.json({ thread_id: created.thread_id, existing: created.existing });
}
