import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyGlobal } from "@/lib/push";
import { generateOccurrenceDates } from "@/lib/recurrence";
import { withNoStore } from "@/lib/cacheHeaders";
import crypto from "crypto";

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const supabase = supabaseServer();
  const { data: events, error } = await supabase
    .from("global_events")
    .select("id, title, event_date, event_time, location, notes, volunteers_needed, allow_rsvp, recurrence_group_id")
    .order("event_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const withExtras = await Promise.all(
    events.map(async (ev) => {
      const { data: rsvps } = await supabase
        .from("global_event_rsvps")
        .select("user_id, status")
        .eq("event_id", ev.id);

      const summary = { yes: 0, no: 0, maybe: 0 };
      let myStatus = null;
      for (const r of rsvps || []) {
        summary[r.status] = (summary[r.status] || 0) + 1;
        if (r.user_id === user.id) myStatus = r.status;
      }

      let volunteerCount = 0;
      let iVolunteered = false;
      if (ev.volunteers_needed) {
        const { data: vols } = await supabase
          .from("global_event_volunteers")
          .select("user_id")
          .eq("event_id", ev.id);
        volunteerCount = vols?.length || 0;
        iVolunteered = (vols || []).some((v) => v.user_id === user.id);
      }

      return { ...ev, rsvp_summary: summary, my_rsvp: myStatus, volunteer_count: volunteerCount, i_volunteered: iVolunteered };
    })
  );

  return withNoStore({ events: withExtras });
}

// repeat ("weekly" | "biweekly" | "monthly") + repeat_count together
// generate multiple real, independent rows sharing one
// recurrence_group_id -- see lib/recurrence.js for why, and
// migration_012 for the schema. volunteers_needed is a plain optional
// bolt-on field, not a separate feature to enable anywhere.
export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { title, event_date, event_time, location, notes, volunteers_needed, allow_rsvp, repeat, repeat_count } = await req.json();
  if (!title?.trim() || !event_date) {
    return NextResponse.json({ error: "title and event_date are required." }, { status: 400 });
  }

  const dates = generateOccurrenceDates(event_date, repeat, repeat_count);
  const recurrenceGroupId = dates.length > 1 ? crypto.randomUUID() : null;

  const rows = dates.map((d) => ({
    title: title.trim(),
    event_date: d,
    event_time: event_time || null,
    location: location || null,
    notes: notes || null,
    volunteers_needed: volunteers_needed ? Number(volunteers_needed) : null,
    allow_rsvp: allow_rsvp === undefined ? true : Boolean(allow_rsvp),
    recurrence_group_id: recurrenceGroupId,
    created_by: user.id,
  }));

  const supabase = supabaseServer();
  const { data, error } = await supabase.from("global_events").insert(rows).select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  notifyGlobal({
    title: "Church Event",
    body: dates.length > 1 ? `${title.trim()} (${dates.length} dates)` : title.trim(),
    url: "/?tab=events",
  }).catch(() => {});

  return NextResponse.json({ events: data });
}
