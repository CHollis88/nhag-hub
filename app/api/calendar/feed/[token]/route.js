import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { withColumnFallback } from "@/lib/compat";
import { readCalendarToken } from "@/lib/calendarToken";
import { buildIcsFeed } from "@/lib/ics";
import { shiftDate } from "@/lib/localDate";

// v71.25 -- a person's whole calendar as a subscribable .ics feed: church-wide
// events plus every ministry they're an active member of (same rule as the
// Calendar tab). Phones fetch this by themselves every few hours, so it's
// 3 small queries per refresh. The token IS the credential (no cookie).
export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const { token } = await params;
  const userId = readCalendarToken(decodeURIComponent(token || ""));
  if (!userId) return new NextResponse("Not found", { status: 404 });

  const supabase = supabaseServer();
  const [userRes, memRes] = await Promise.all([
    supabase.from("users").select("id, is_church_admin").eq("id", userId).maybeSingle(),
    withColumnFallback(
      () => supabase.from("group_members").select("group_id, groups(name, hidden, hide_restricts_access, archived_at)").eq("user_id", userId).eq("status", "active"),
      () => supabase.from("group_members").select("group_id, groups(name, hidden, hide_restricts_access)").eq("user_id", userId).eq("status", "active")
    ),
  ]);
  const user = userRes.data;
  if (!user) return new NextResponse("Not found", { status: 404 });

  const groups = (memRes.data || [])
    .filter((m) => !m.groups?.archived_at)
    .filter((m) => user.is_church_admin || !(m.groups?.hidden && m.groups?.hide_restricts_access));
  const groupName = new Map(groups.map((m) => [m.group_id, m.groups?.name || "Ministry"]));
  const groupIds = [...groupName.keys()];

  // A month of history (so a just-finished event doesn't vanish) and everything ahead.
  const since = shiftDate(new Date().toISOString().slice(0, 10), -30);
  const cols = "id, title, event_date, event_time, location, notes";
  const [g, ge] = await Promise.all([
    supabase.from("global_events").select(cols).gte("event_date", since).order("event_date").limit(1000),
    groupIds.length
      ? supabase.from("group_events").select(`${cols}, group_id`).in("group_id", groupIds).gte("event_date", since).order("event_date").limit(2000)
      : Promise.resolve({ data: [] }),
  ]);

  const events = [
    ...(g.data || []),
    ...(ge.data || []).map((e) => ({ ...e, title: `${groupName.get(e.group_id)}: ${e.title}` })),
  ];

  return new NextResponse(buildIcsFeed(events, { name: "NHAG Church Hub" }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
      "Content-Disposition": 'inline; filename="nhag-calendar.ics"',
    },
  });
}
