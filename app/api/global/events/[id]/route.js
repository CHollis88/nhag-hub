import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

// Editing a single event's own details -- title, date, time, location.
// Deliberately does not touch recurrence/allow_rsvp/allow_replies here;
// those are set at creation and this keeps the edit surface simple, same
// scope as editing a News post's title/body.
export async function PATCH(req, { params }) {
  const { id } = await params;
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { title, event_date, event_time, location, notes } = await req.json();
  const updates = {};
  if (title !== undefined) {
    if (!title.trim()) return NextResponse.json({ error: "title can't be empty." }, { status: 400 });
    updates.title = title.trim();
  }
  if (event_date !== undefined) updates.event_date = event_date;
  if (event_time !== undefined) updates.event_time = event_time || null;
  if (location !== undefined) updates.location = location || null;
  if (notes !== undefined) updates.notes = notes || null;

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("global_events")
    .update(updates)
    .eq("id", id)
    .select("id, title, event_date, event_time, location, notes")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}

// scope=series (query param) deletes this occurrence and every future
// occurrence sharing the same recurrence_group_id -- past occurrences in
// the same series are left alone, matching how most calendar apps handle
// "delete this and following events."
export async function DELETE(req, { params }) {
  const { id } = await params;
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const scope = new URL(req.url).searchParams.get("scope");
  const supabase = supabaseServer();

  if (scope === "series") {
    const { data: event, error: fetchError } = await supabase
      .from("global_events")
      .select("recurrence_group_id, event_date")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

    if (event?.recurrence_group_id) {
      const { error } = await supabase
        .from("global_events")
        .delete()
        .eq("recurrence_group_id", event.recurrence_group_id)
        .gte("event_date", event.event_date);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    // Not actually part of a series -- fall through to deleting just this one.
  }

  const { error } = await supabase.from("global_events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
