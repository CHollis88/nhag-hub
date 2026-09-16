import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withPrivateCache } from "@/lib/cacheHeaders";

const VALID_STATUSES = ["yes", "no", "maybe"];

export async function GET(req, { params }) {
  params = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("global_event_rsvps")
    .select("status, updated_at, users(display_name)")
    .eq("event_id", params.id)
    .order("updated_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return withPrivateCache({ rsvps: data });
}

export async function POST(req, { params }) {
  params = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { status } = await req.json();
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: event, error: eventError } = await supabase
    .from("global_events")
    .select("allow_rsvp")
    .eq("id", params.id)
    .maybeSingle();
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (!event.allow_rsvp) {
    return NextResponse.json({ error: "RSVP is turned off for this event." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("global_event_rsvps")
    .upsert(
      { event_id: params.id, user_id: user.id, status, updated_at: new Date().toISOString() },
      { onConflict: "event_id,user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rsvp: data });
}

// Lets someone clear their RSVP entirely (back to "no response"), not
// just switch between Yes/Maybe/No -- tapping an already-selected status
// again in the UI calls this.
export async function DELETE(req, { params }) {
  const { id } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("global_event_rsvps")
    .delete()
    .eq("event_id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
