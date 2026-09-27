import { NextResponse } from "next/server";
import { fetchByIds, groupBy } from "@/lib/batchFetch";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";
import { notifyGroup } from "@/lib/push";
import { withNoStore } from "@/lib/cacheHeaders";
import { generateOccurrenceDates } from "@/lib/recurrence";
import crypto from "crypto";

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data: events, error } = await supabase
    .from("group_events")
    .select("id, title, event_date, event_time, location, notes, volunteers_needed, allow_replies, allow_rsvp, recurrence_group_id")
    .eq("group_id", groupId)
    .order("event_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // RSVPs and volunteers for ALL events in two bulk queries, instead of
  // one or two queries per event (see lib/batchFetch.js).
  let rsvpsByEvent, volsByEvent;
  try {
    const ids = events.map((ev) => ev.id);
    const volIds = events.filter((ev) => ev.volunteers_needed).map((ev) => ev.id);
    const [rsvps, vols] = await Promise.all([
      fetchByIds(supabase, "group_event_rsvps", "event_id", ids, "event_id, user_id, status"),
      fetchByIds(supabase, "group_event_volunteers", "event_id", volIds, "event_id, user_id"),
    ]);
    rsvpsByEvent = groupBy(rsvps, "event_id");
    volsByEvent = groupBy(vols, "event_id");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const withExtras = events.map((ev) => {
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
  });

  return withNoStore({ events: withExtras });
}

export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can add Events." },
      { status: 403 }
    );
  }

  const { title, event_date, event_time, location, notes, volunteers_needed, allow_replies, allow_rsvp, repeat, repeat_count, notify } = await req.json();
  if (!title?.trim() || !event_date) {
    return NextResponse.json({ error: "title and event_date are required." }, { status: 400 });
  }
  const shouldNotify = notify !== false;

  const dates = generateOccurrenceDates(event_date, repeat, repeat_count);
  const recurrenceGroupId = dates.length > 1 ? crypto.randomUUID() : null;

  const rows = dates.map((d) => ({
    group_id: groupId,
    title: title.trim(),
    event_date: d,
    event_time: event_time || null,
    location: location || null,
    notes: notes || null,
    volunteers_needed: volunteers_needed ? Number(volunteers_needed) : null,
    allow_replies: allow_replies === undefined ? true : Boolean(allow_replies),
    allow_rsvp: allow_rsvp === undefined ? true : Boolean(allow_rsvp),
    recurrence_group_id: recurrenceGroupId,
    created_by: user.id,
  }));

  const supabase = supabaseServer();
  const { data, error } = await supabase.from("group_events").insert(rows).select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (shouldNotify) {
    notifyGroup(groupId, {
      title: "Group Event",
      body: dates.length > 1 ? `${title.trim()} (${dates.length} dates)` : title.trim(),
      url: `/?group=${groupId}&tab=events`,
    }).catch(() => {});
  }

  return NextResponse.json({ events: data });
}
