import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

// Toggling mute or marking a thread read -- both scoped to MY
// participant row only, never affecting the other participant(s). Mute
// silences push/in-app-notification alerts for this thread (see
// notifyDmThread in lib/push.js) but does NOT hide its unread count --
// that's computed from last_read_at vs message timestamps, independent
// of mute, per Cam's decision that a muted thread should still show you
// how many you've missed once you open the app.
export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { threadId } = await params;
  const { muted, mark_read } = await req.json();

  const supabase = supabaseServer();
  const { data: myRow } = await supabase
    .from("group_dm_participants")
    .select("thread_id")
    .eq("thread_id", threadId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!myRow) {
    return NextResponse.json({ error: "You're not part of this conversation." }, { status: 403 });
  }

  const updates = {};
  if (muted !== undefined) updates.muted = Boolean(muted);
  if (mark_read) updates.last_read_at = new Date().toISOString();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await supabase
    .from("group_dm_participants")
    .update(updates)
    .eq("thread_id", threadId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
