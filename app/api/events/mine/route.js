import { NextResponse } from "next/server";
import { fetchByIds, groupBy } from "@/lib/batchFetch";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";

// v71 #1 -- ONE call for Home's "Your Next Event" and the Calendar tab.
// Replaces 1 + N requests from the client (church-wide events, then one
// events call per ministry, each of which then made its own membership and
// RSVP/volunteer queries) with:
//   * memberships from the session lookup (no query),
//   * one query for church-wide events,
//   * one query for every one of my ministries' events (.in group_id),
//   * bulk RSVP / volunteer fetches via lib/batchFetch.js.
//
// Response shape: { global: [...], groups: { [groupId]: [...] } } -- each
// event has the same fields the per-ministry / church-wide routes return,
// so the existing cards keep working unchanged.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  // Same access rule as isActiveGroupMember: a ministry hidden with
  // hide_restricts_access is fully offline for everyone but an admin.
  const groupIds = (user.memberships || [])
    .filter((m) => !m.archived) // v71 #24: archived ministries drop off everyone's calendar
    .filter((m) => user.is_church_admin || !(m.hidden && m.hide_restricts_access))
    .map((m) => m.group_id);

  const supabase = supabaseServer();

  const [globalRes, groupRes] = await Promise.all([
    supabase
      .from("global_events")
      .select("id, title, event_date, event_time, location, notes, volunteers_needed, allow_rsvp, recurrence_group_id")
      .order("event_date", { ascending: true }),
    groupIds.length
      ? supabase
          .from("group_events")
          .select("id, group_id, title, event_date, event_time, location, notes, volunteers_needed, allow_replies, allow_rsvp, recurrence_group_id")
          .in("group_id", groupIds)
          .order("event_date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (globalRes.error) return NextResponse.json({ error: globalRes.error.message }, { status: 500 });
  if (groupRes.error) return NextResponse.json({ error: groupRes.error.message }, { status: 500 });

  const globalEvents = globalRes.data || [];
  const groupEvents = groupRes.data || [];

  let gRsvps, gVols, grRsvps, grVols;
  try {
    const gIds = globalEvents.map((e) => e.id);
    const gVolIds = globalEvents.filter((e) => e.volunteers_needed).map((e) => e.id);
    const grIds = groupEvents.map((e) => e.id);
    const grVolIds = groupEvents.filter((e) => e.volunteers_needed).map((e) => e.id);
    const [a, b, c, d] = await Promise.all([
      fetchByIds(supabase, "global_event_rsvps", "event_id", gIds, "event_id, user_id, status"),
      fetchByIds(supabase, "global_event_volunteers", "event_id", gVolIds, "event_id, user_id"),
      fetchByIds(supabase, "group_event_rsvps", "event_id", grIds, "event_id, user_id, status"),
      fetchByIds(supabase, "group_event_volunteers", "event_id", grVolIds, "event_id, user_id"),
    ]);
    gRsvps = groupBy(a, "event_id");
    gVols = groupBy(b, "event_id");
    grRsvps = groupBy(c, "event_id");
    grVols = groupBy(d, "event_id");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const decorate = (ev, rsvpsByEvent, volsByEvent) => {
    const summary = { yes: 0, no: 0, maybe: 0 };
    let myStatus = null;
    for (const r of rsvpsByEvent.get(ev.id) || []) {
      summary[r.status] = (summary[r.status] || 0) + 1;
      if (r.user_id === user.id) myStatus = r.status;
    }
    let volunteerCount = 0;
    let iVolunteered = false;
    if (ev.volunteers_needed) {
      const vols = volsByEvent.get(ev.id) || [];
      volunteerCount = vols.length;
      iVolunteered = vols.some((v) => v.user_id === user.id);
    }
    return { ...ev, rsvp_summary: summary, my_rsvp: myStatus, volunteer_count: volunteerCount, i_volunteered: iVolunteered };
  };

  const groups = {};
  for (const id of groupIds) groups[id] = [];
  for (const ev of groupEvents) {
    groups[ev.group_id].push(decorate(ev, grRsvps, grVols));
  }

  return withNoStore({
    global: globalEvents.map((ev) => decorate(ev, gRsvps, gVols)),
    groups,
  });
}
