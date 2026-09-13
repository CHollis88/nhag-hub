import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isActiveGroupMember } from "@/lib/groupAuth";

const VALID_STATUSES = ["yes", "no", "maybe"];

// Returns the full list of who RSVP'd what -- same transparency as the
// Roster (any active member can see it), useful for planning ("who's
// actually coming to rehearsal").
export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, eventId } = params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_event_rsvps")
    .select("status, updated_at, users(display_name)")
    .eq("event_id", eventId)
    .order("updated_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rsvps: data });
}

// Any active member can RSVP to their own group's events -- this isn't
// leader-gated, unlike creating the event itself.
export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, eventId } = params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const { status } = await req.json();
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_event_rsvps")
    .upsert(
      { event_id: eventId, user_id: user.id, status, updated_at: new Date().toISOString() },
      { onConflict: "event_id,user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rsvp: data });
}
