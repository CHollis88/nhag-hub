import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req, { params }) {
  const { id } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("global_event_volunteers")
    .select("user_id, created_at, users!user_id(display_name)")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ volunteers: data });
}

// Enforces the volunteers_needed cap server-side -- once full, further
// sign-ups are rejected with a clear reason, rather than silently
// overbooking a sign-up sheet.
export async function POST(req, { params }) {
  const { id } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();
  const { data: event, error: eventError } = await supabase
    .from("global_events")
    .select("volunteers_needed")
    .eq("id", id)
    .maybeSingle();
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
  if (!event?.volunteers_needed) {
    return NextResponse.json({ error: "This event isn't taking volunteer sign-ups." }, { status: 400 });
  }

  const { count } = await supabase
    .from("global_event_volunteers")
    .select("user_id", { count: "exact", head: true })
    .eq("event_id", id);
  if ((count || 0) >= event.volunteers_needed) {
    return NextResponse.json({ error: "All volunteer spots for this event are filled." }, { status: 400 });
  }

  const { error } = await supabase
    .from("global_event_volunteers")
    .insert({ event_id: id, user_id: user.id });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "You're already signed up." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("global_event_volunteers")
    .delete()
    .eq("event_id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
