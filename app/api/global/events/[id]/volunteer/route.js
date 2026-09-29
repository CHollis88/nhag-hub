import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";
import { rpcFailure } from "@/lib/rpc";

export async function GET(req, { params }) {
  const { id } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("global_event_volunteers")
    .select("user_id, created_at, users(display_name)")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return withNoStore({ volunteers: data });
}

// Enforces the volunteers_needed cap server-side -- once full, further
// sign-ups are rejected with a clear reason, rather than silently
// overbooking a sign-up sheet.
export async function POST(req, { params }) {
  const { id } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  // v71 #10: capacity check + insert are one locked database step
  // (global_volunteer_signup, migration_034) -- no overbooking under
  // simultaneous taps.
  const supabase = supabaseServer();
  const { data, error } = await supabase.rpc("global_volunteer_signup", {
    p_event_id: id,
    p_user_id: user.id,
  });
  if (error) return rpcFailure(error);

  switch (data?.status) {
    case "ok":
      return NextResponse.json({ ok: true, volunteer_count: data.count });
    case "already":
      return NextResponse.json({ error: "You're already signed up.", volunteer_count: data.count }, { status: 409 });
    case "full":
      return NextResponse.json({ error: "All volunteer spots for this event are filled.", volunteer_count: data.count }, { status: 400 });
    case "closed":
      return NextResponse.json({ error: "This event isn't taking volunteer sign-ups." }, { status: 400 });
    default:
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
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
