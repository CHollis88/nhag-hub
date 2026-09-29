import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isActiveGroupMember, assertInGroup } from "@/lib/groupAuth";
import { withNoStore } from "@/lib/cacheHeaders";
import { rpcFailure } from "@/lib/rpc";

export async function GET(req, { params }) {
  const { id: groupId, eventId } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  // v71 #2: this handler had no membership check at all -- any signed-in
  // user could list any event's volunteers.
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }
  if (!(await assertInGroup("group_events", eventId, groupId))) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_event_volunteers")
    .select("user_id, created_at, users(display_name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return withNoStore({ volunteers: data });
}

export async function POST(req, { params }) {
  const { id: groupId, eventId } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  // v71 #10: the capacity check and the insert happen together inside the
  // database, with the event row locked (volunteer_signup, migration_034).
  // The old count-then-insert let two people tapping at once both pass the
  // count and overbook the sheet.
  const supabase = supabaseServer();
  const { data, error } = await supabase.rpc("volunteer_signup", {
    p_event_id: eventId,
    p_user_id: user.id,
    p_group_id: groupId,
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
  const { id: groupId, eventId } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  // Only removes the caller's own signup, but still bind it to the group
  // (and require membership) like every other handler here.
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }
  if (!(await assertInGroup("group_events", eventId, groupId))) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("group_event_volunteers")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
