import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// Called on a schedule by Vercel Cron (see vercel.json) -- protected by
// the same shared secret as the reading reminder. Per the project's
// decision, News and Events auto-hard-delete after 30 days, church-wide
// and in every ministry alike. Prayer is deliberately NOT included here
// -- only News/Events were asked for.
//
// For News, "30 days" means 30 days since it was posted (created_at).
// For Events, it means 30 days since the event itself happened
// (event_date) -- so an event scheduled for next month never
// disappears just because it was created a month ago; the clock starts
// when the event date passes, not when it was created.
//
// Direct Messages and Group Chat (migrations 026/027) also auto-delete,
// on their own longer clock -- 90 days since a message was sent. These
// are conversational, not archival like News, so a longer window than
// News/Events made sense; unlike News/Events there's no external
// document a leader would need to reference indefinitely, so a rolling
// window keeps storage bounded without needing an admin to manage it.
// Reactions (migration_028) have no foreign-key cascade to either
// message table -- one shared table serves both DM and Chat messages
// via a message_type discriminator, so a DB-level cascade isn't
// possible -- meaning a deleted message's reactions must be deleted
// here explicitly first, or they'd become permanently orphaned rows.
export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = supabaseServer();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgoDate = thirtyDaysAgo.slice(0, 10); // date-only, for event_date columns
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const results = {};

  const { count: globalNews } = await supabase
    .from("global_news")
    .delete({ count: "exact" })
    .lt("created_at", thirtyDaysAgo);
  results.global_news_deleted = globalNews || 0;

  const { count: globalEvents } = await supabase
    .from("global_events")
    .delete({ count: "exact" })
    .lt("event_date", thirtyDaysAgoDate);
  results.global_events_deleted = globalEvents || 0;

  const { count: groupNews } = await supabase
    .from("group_news")
    .delete({ count: "exact" })
    .lt("created_at", thirtyDaysAgo);
  results.group_news_deleted = groupNews || 0;

  const { count: groupEvents } = await supabase
    .from("group_events")
    .delete({ count: "exact" })
    .lt("event_date", thirtyDaysAgoDate);
  results.group_events_deleted = groupEvents || 0;

  // DM messages: fetch the IDs about to be deleted first, so their
  // reactions can be cleaned up by ID before the messages themselves go.
  const { data: oldDmMessages } = await supabase
    .from("group_dm_messages")
    .select("id")
    .lt("created_at", ninetyDaysAgo);
  const oldDmMessageIds = (oldDmMessages || []).map((m) => m.id);
  if (oldDmMessageIds.length) {
    await supabase.from("message_reactions").delete().eq("message_type", "dm").in("message_id", oldDmMessageIds);
  }
  const { count: dmMessages } = await supabase
    .from("group_dm_messages")
    .delete({ count: "exact" })
    .lt("created_at", ninetyDaysAgo);
  results.dm_messages_deleted = dmMessages || 0;

  // Group Chat messages: same reactions-first pattern.
  const { data: oldChatMessages } = await supabase
    .from("group_chat_messages")
    .select("id")
    .lt("created_at", ninetyDaysAgo);
  const oldChatMessageIds = (oldChatMessages || []).map((m) => m.id);
  if (oldChatMessageIds.length) {
    await supabase
      .from("message_reactions")
      .delete()
      .eq("message_type", "group_chat")
      .in("message_id", oldChatMessageIds);
  }
  const { count: chatMessages } = await supabase
    .from("group_chat_messages")
    .delete({ count: "exact" })
    .lt("created_at", ninetyDaysAgo);
  results.chat_messages_deleted = chatMessages || 0;

  return NextResponse.json({ ok: true, ...results });
}
