import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isActiveGroupMember, canManageGroup } from "@/lib/groupAuth";
import { withNoStore } from "@/lib/cacheHeaders";

// Powers the little "something's new" dot on this group's own tab bar
// (GroupBottomNav / GroupSidebar). News/Events/Prayer work like the
// church-wide equivalent (/api/notifications/latest): just the latest
// created_at per type, compared client-side against a locally-stored
// "last seen" timestamp -- cheap, and fine for content everyone in the
// group sees the same way.
//
// Messages and Chat are different on purpose: unlike News/Events, "have
// I read this" is already tracked server-side, per person, for real
// (group_dm_participants.last_read_at, group_chat_reads.last_read_at) --
// so their badges are actual server-computed unread state, not a
// client-side timestamp guess. This is also why a chat/DM notification
// click needing to land on the right screen NEVER on its own puts a dot
// back on the tab: the dot clears only when the person actually opens
// and reads that thread/channel (last_read_at moves forward), same as
// the unread counts already shown inside Messages' own thread list.
export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const isManager = await canManageGroup(user, groupId);

  const [newsRes, eventsRes, prayerRes, groupRes] = await Promise.all([
    supabase.from("group_news").select("created_at").eq("group_id", groupId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("group_events").select("created_at").eq("group_id", groupId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("group_prayer").select("created_at").eq("group_id", groupId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("groups").select("features").eq("id", groupId).maybeSingle(),
  ]);

  const features = groupRes.data?.features || [];
  let dmUnreadCount = 0;
  let chatMembersUnread = false;
  let chatLeadersUnread = false;

  if (features.includes("direct_messages")) {
    const { data: myRows } = await supabase
      .from("group_dm_participants")
      .select("thread_id, last_read_at, group_dm_threads!inner(group_id)")
      .eq("user_id", user.id)
      .eq("group_dm_threads.group_id", groupId);

    const threadIds = (myRows || []).map((r) => r.thread_id);
    if (threadIds.length) {
      const { data: messages } = await supabase
        .from("group_dm_messages")
        .select("thread_id, sender_id, created_at")
        .in("thread_id", threadIds);

      const lastReadByThread = Object.fromEntries((myRows || []).map((r) => [r.thread_id, r.last_read_at]));
      dmUnreadCount = (messages || []).filter((m) => {
        if (m.sender_id === user.id) return false;
        const lastRead = lastReadByThread[m.thread_id];
        return !lastRead || m.created_at > lastRead;
      }).length;
    }
  }

  if (features.includes("chat_members") || features.includes("chat_leaders")) {
    const channels = [];
    if (features.includes("chat_members")) channels.push("members");
    if (features.includes("chat_leaders") && isManager) channels.push("leaders");

    if (channels.length) {
      const { data: reads } = await supabase
        .from("group_chat_reads")
        .select("channel, last_read_at")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .in("channel", channels);
      const lastReadByChannel = Object.fromEntries((reads || []).map((r) => [r.channel, r.last_read_at]));

      const { data: messages } = await supabase
        .from("group_chat_messages")
        .select("channel, sender_id, created_at")
        .eq("group_id", groupId)
        .in("channel", channels);

      for (const m of messages || []) {
        if (m.sender_id === user.id) continue;
        const lastRead = lastReadByChannel[m.channel];
        const isUnread = !lastRead || m.created_at > lastRead;
        if (!isUnread) continue;
        if (m.channel === "members") chatMembersUnread = true;
        if (m.channel === "leaders") chatLeadersUnread = true;
      }
    }
  }

  return withNoStore({
    news: newsRes.data?.created_at || null,
    events: eventsRes.data?.created_at || null,
    prayer: prayerRes.data?.created_at || null,
    dm_unread_count: dmUnreadCount,
    chat_unread: chatMembersUnread || chatLeadersUnread,
  });
}
