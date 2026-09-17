import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";

const VALID_TYPES = ["dm", "group_chat"];
// Fixed set per Cam's decision -- no open emoji picker, just these four.
const ALLOWED_EMOJI = ["👍", "❤️", "🙏", "😂"];

async function canReactTo(supabase, user, type, messageId) {
  if (type === "dm") {
    const { data: message } = await supabase
      .from("group_dm_messages")
      .select("thread_id")
      .eq("id", messageId)
      .maybeSingle();
    if (!message) return false;
    const { data: participant } = await supabase
      .from("group_dm_participants")
      .select("thread_id")
      .eq("thread_id", message.thread_id)
      .eq("user_id", user.id)
      .maybeSingle();
    return Boolean(participant);
  }

  const { data: message } = await supabase
    .from("group_chat_messages")
    .select("group_id, channel")
    .eq("id", messageId)
    .maybeSingle();
  if (!message) return false;
  return message.channel === "leaders"
    ? canManageGroup(user, message.group_id)
    : isActiveGroupMember(user, message.group_id);
}

// Toggles one emoji for the current user on one message -- react again
// with the same emoji to remove it. Reactions are shared by both message
// types via a message_type discriminator (migration_028).
export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { type, messageId } = await params;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid message type." }, { status: 400 });
  }

  const { emoji } = await req.json();
  if (!ALLOWED_EMOJI.includes(emoji)) {
    return NextResponse.json({ error: "That emoji isn't available for reactions." }, { status: 400 });
  }

  const supabase = supabaseServer();
  if (!(await canReactTo(supabase, user, type, messageId))) {
    return NextResponse.json({ error: "You don't have access to that message." }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_type", type)
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("message_reactions").delete().eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reacted: false });
  }

  const { error } = await supabase
    .from("message_reactions")
    .insert({ message_type: type, message_id: messageId, user_id: user.id, emoji });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reacted: true });
}
