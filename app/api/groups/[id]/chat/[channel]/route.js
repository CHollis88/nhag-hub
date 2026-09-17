import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";

const VALID_CHANNELS = ["members", "leaders"];

async function hasChannelAccess(user, groupId, channel) {
  if (channel === "leaders") return canManageGroup(user, groupId);
  return isActiveGroupMember(user, groupId);
}

// Toggling mute or marking a channel read -- scoped to MY row only, same
// mute semantics as DM threads (see notifyGroupChatChannel in
// lib/push.js): silences alerts, never hides the unread count.
export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, channel } = await params;
  if (!VALID_CHANNELS.includes(channel)) {
    return NextResponse.json({ error: "Invalid channel." }, { status: 400 });
  }
  if (!(await hasChannelAccess(user, groupId, channel))) {
    return NextResponse.json({ error: "You don't have access to that chat." }, { status: 403 });
  }

  const { muted, mark_read } = await req.json();
  const updates = {};
  if (muted !== undefined) updates.muted = Boolean(muted);
  if (mark_read) updates.last_read_at = new Date().toISOString();
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("group_chat_reads")
    .upsert(
      { group_id: groupId, channel, user_id: user.id, ...updates },
      { onConflict: "group_id,channel,user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
