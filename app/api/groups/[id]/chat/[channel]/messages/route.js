import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";
import { notifyGroupChatChannel } from "@/lib/push";
import { withNoStore } from "@/lib/cacheHeaders";

const VALID_CHANNELS = ["members", "leaders"];

// 'leaders' channel: only that group's own active leaders (or a Church
// Admin) can read or post -- canManageGroup already encodes exactly that
// check. 'members' channel: any active member (leader or member).
async function hasChannelAccess(user, groupId, channel) {
  if (channel === "leaders") return canManageGroup(user, groupId);
  return isActiveGroupMember(user, groupId);
}

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, channel } = await params;
  if (!VALID_CHANNELS.includes(channel)) {
    return NextResponse.json({ error: "Invalid channel." }, { status: 400 });
  }
  if (!(await hasChannelAccess(user, groupId, channel))) {
    return NextResponse.json({ error: "You don't have access to that chat." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data: messages, error } = await supabase
    .from("group_chat_messages")
    .select("id, sender_id, body, created_at, users(display_name)")
    .eq("group_id", groupId)
    .eq("channel", channel)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const messageIds = (messages || []).map((m) => m.id);
  const { data: reactions } = messageIds.length
    ? await supabase
        .from("message_reactions")
        .select("message_id, emoji, user_id")
        .eq("message_type", "group_chat")
        .in("message_id", messageIds)
    : { data: [] };

  const reactionsByMessage = {};
  for (const r of reactions || []) {
    if (!reactionsByMessage[r.message_id]) reactionsByMessage[r.message_id] = [];
    reactionsByMessage[r.message_id].push({ emoji: r.emoji, user_id: r.user_id });
  }

  const withReactions = (messages || []).map((m) => ({ ...m, reactions: reactionsByMessage[m.id] || [] }));

  // no-store -- polled every 4s while this channel is open (see
  // GroupChatTab), same reasoning as the DM messages endpoint.
  return withNoStore({ messages: withReactions });
}

export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, channel } = await params;
  if (!VALID_CHANNELS.includes(channel)) {
    return NextResponse.json({ error: "Invalid channel." }, { status: 400 });
  }
  if (!(await hasChannelAccess(user, groupId, channel))) {
    return NextResponse.json({ error: "You don't have access to that chat." }, { status: 403 });
  }

  const { body } = await req.json();
  if (!body || !body.trim()) {
    return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: message, error } = await supabase
    .from("group_chat_messages")
    .insert({ group_id: groupId, channel, sender_id: user.id, body: body.trim() })
    .select("id, sender_id, body, created_at, users(display_name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("group_chat_reads")
    .upsert(
      { group_id: groupId, channel, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: "group_id,channel,user_id" }
    );

  notifyGroupChatChannel(groupId, channel, user.id, {
    title: channel === "leaders" ? "Leaders Chat" : `${user.display_name}`,
    body: body.trim().slice(0, 140),
    url: `/?group=${groupId}&tab=chat&channel=${channel}`,
  }).catch(() => {});

  return NextResponse.json({ message: { ...message, reactions: [] } });
}

// "Clear chat" -- wipes every message (and their reactions) in this one
// channel, keeping the channel itself (and the other channel, if the
// ministry has both) untouched. Leader/admin-gated regardless of which
// channel: unlike a DM thread, a Chat channel is a ministry-wide asset,
// not a private space between two people, so a regular member shouldn't
// be able to wipe its history even for the Members channel they can
// otherwise post in.
export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, channel } = await params;
  if (!VALID_CHANNELS.includes(channel)) {
    return NextResponse.json({ error: "Invalid channel." }, { status: 400 });
  }
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json({ error: "Only this group's leaders or a Church Admin can clear chat." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data: messages } = await supabase
    .from("group_chat_messages")
    .select("id")
    .eq("group_id", groupId)
    .eq("channel", channel);

  const messageIds = (messages || []).map((m) => m.id);
  if (messageIds.length) {
    await supabase.from("message_reactions").delete().eq("message_type", "group_chat").in("message_id", messageIds);
  }

  const { error } = await supabase
    .from("group_chat_messages")
    .delete()
    .eq("group_id", groupId)
    .eq("channel", channel);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
