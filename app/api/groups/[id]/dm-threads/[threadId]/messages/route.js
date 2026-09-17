import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyDmThread } from "@/lib/push";
import { withNoStore } from "@/lib/cacheHeaders";

async function isParticipant(supabase, threadId, userId) {
  const { data } = await supabase
    .from("group_dm_participants")
    .select("thread_id")
    .eq("thread_id", threadId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { threadId } = await params;
  const supabase = supabaseServer();

  if (!(await isParticipant(supabase, threadId, user.id))) {
    return NextResponse.json({ error: "You're not part of this conversation." }, { status: 403 });
  }

  const { data: messages, error } = await supabase
    .from("group_dm_messages")
    .select("id, sender_id, body, created_at, users(display_name)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const messageIds = (messages || []).map((m) => m.id);
  const { data: reactions } = messageIds.length
    ? await supabase
        .from("message_reactions")
        .select("message_id, emoji, user_id")
        .eq("message_type", "dm")
        .in("message_id", messageIds)
    : { data: [] };

  const reactionsByMessage = {};
  for (const r of reactions || []) {
    if (!reactionsByMessage[r.message_id]) reactionsByMessage[r.message_id] = [];
    reactionsByMessage[r.message_id].push({ emoji: r.emoji, user_id: r.user_id });
  }

  const withReactions = (messages || []).map((m) => ({ ...m, reactions: reactionsByMessage[m.id] || [] }));

  // no-store, not a short private cache -- this endpoint is polled every
  // 4s while a thread is open (see DirectMessagesTab), so it needs to
  // actually hit the network every time, same reasoning as
  // /api/notifications' own no-store.
  return withNoStore({ messages: withReactions });
}

export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, threadId } = await params;
  const { body } = await req.json();
  if (!body || !body.trim()) {
    return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  }

  const supabase = supabaseServer();
  if (!(await isParticipant(supabase, threadId, user.id))) {
    return NextResponse.json({ error: "You're not part of this conversation." }, { status: 403 });
  }

  const { data: message, error } = await supabase
    .from("group_dm_messages")
    .insert({ thread_id: threadId, sender_id: user.id, body: body.trim() })
    .select("id, sender_id, body, created_at, users(display_name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // My own last_read_at should reflect my own message too, so my own
  // sent message never counts toward my own unread badge.
  await supabase
    .from("group_dm_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("user_id", user.id);

  notifyDmThread(threadId, user.id, {
    title: `${user.display_name}`,
    body: body.trim().slice(0, 140),
    url: `/?group=${groupId}&tab=dm&thread=${threadId}`,
  }).catch(() => {});

  return NextResponse.json({ message: { ...message, reactions: [] } });
}
