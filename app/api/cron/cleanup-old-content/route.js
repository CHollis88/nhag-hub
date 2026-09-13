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
export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = supabaseServer();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgoDate = thirtyDaysAgo.slice(0, 10); // date-only, for event_date columns

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

  return NextResponse.json({ ok: true, ...results });
}
