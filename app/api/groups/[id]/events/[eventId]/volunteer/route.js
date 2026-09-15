import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isActiveGroupMember } from "@/lib/groupAuth";

export async function GET(req, { params }) {
  const { eventId } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_event_volunteers")
    .select("user_id, created_at, users!user_id(display_name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ volunteers: data });
}

export async function POST(req, { params }) {
  const { id: groupId, eventId } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data: event, error: eventError } = await supabase
    .from("group_events")
    .select("volunteers_needed")
    .eq("id", eventId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
  if (!event?.volunteers_needed) {
    return NextResponse.json({ error: "This event isn't taking volunteer sign-ups." }, { status: 400 });
  }

  const { count } = await supabase
    .from("group_event_volunteers")
    .select("user_id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if ((count || 0) >= event.volunteers_needed) {
    return NextResponse.json({ error: "All volunteer spots for this event are filled." }, { status: 400 });
  }

  const { error } = await supabase
    .from("group_event_volunteers")
    .insert({ event_id: eventId, user_id: user.id });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "You're already signed up." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { eventId } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("group_event_volunteers")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
