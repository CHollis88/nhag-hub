import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyGlobal } from "@/lib/push";

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const supabase = supabaseServer();
  const { data: events, error } = await supabase
    .from("global_events")
    .select("id, title, event_date, event_time, location, notes")
    .order("event_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const withRsvps = await Promise.all(
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
      return { ...ev, rsvp_summary: summary, my_rsvp: myStatus };
    })
  );

  return NextResponse.json({ events: withRsvps });
}

export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { title, event_date, event_time, location, notes } = await req.json();
  if (!title?.trim() || !event_date) {
    return NextResponse.json({ error: "title and event_date are required." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("global_events")
    .insert({
      title: title.trim(),
      event_date,
      event_time: event_time || null,
      location: location || null,
      notes: notes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  notifyGlobal({ title: "Church Event", body: title.trim(), url: "/" }).catch(() => {});

  return NextResponse.json({ event: data });
}
