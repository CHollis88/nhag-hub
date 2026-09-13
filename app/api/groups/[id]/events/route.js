import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";
import { notifyGroup } from "@/lib/push";

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
    .select("id, title, event_date, event_time, location, notes")
    .eq("group_id", groupId)
    .order("event_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach an RSVP summary (counts per status) and this user's own status
  // to each event -- the list view is where people decide whether to open
  // an event, so the count needs to be visible without a second click.
  const withRsvps = await Promise.all(
    events.map(async (ev) => {
      const { data: rsvps } = await supabase
        .from("group_event_rsvps")
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

  const { title, event_date, event_time, location, notes } = await req.json();
  if (!title?.trim() || !event_date) {
    return NextResponse.json({ error: "title and event_date are required." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_events")
    .insert({
      group_id: groupId,
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

  notifyGroup(groupId, { title: "Group Event", body: title.trim(), url: "/" }).catch(() => {});

  return NextResponse.json({ event: data });
}
