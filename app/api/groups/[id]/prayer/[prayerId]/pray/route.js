import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isActiveGroupMember } from "@/lib/groupAuth";
import { notifyGroupMember } from "@/lib/push";
import { rpcFailure } from "@/lib/rpc";

// Toggles: tapping "I'm praying" again removes it and decrements the
// count, so the count always reflects how many people currently have it
// marked, not a one-way running total -- same mechanic as the Young
// Adults/Choir apps' own prayer_prayed table, adapted to use the
// authenticated user_id here instead of a device_id, since this app has
// real accounts rather than the anonymous-device model those used.
export async function POST(req, { params }) {
  const { id: groupId, prayerId } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  // v71 #12: the toggle and the count change happen together in the
  // database, with the prayer row locked (toggle_prayer, migration_034), and
  // the AUTHORITATIVE result comes back -- the client shows exactly this,
  // never a guess. It also enforces that the request belongs to this group.
  const supabase = supabaseServer();
  const { data, error } = await supabase.rpc("toggle_prayer", {
    p_prayer_id: prayerId,
    p_group_id: groupId,
    p_user_id: user.id,
  });
  if (error) return rpcFailure(error);
  if (data?.status !== "ok") return NextResponse.json({ error: "Prayer request not found." }, { status: 404 });

  // Only the prayer's own author needs to know someone's supporting
  // their request -- not the whole group, and not the author themselves
  // if they're the one who tapped it (praying for your own request
  // doesn't need a notification), and not when someone un-marks it.
  // created_by can be null for a request whose author account was later
  // deleted (schema: `on delete set null`), so this is skipped gracefully.
  if (data.i_prayed && data.created_by && data.created_by !== user.id) {
    notifyGroupMember(groupId, data.created_by, {
      title: "Someone is praying for your request",
      body: "Tap to view.",
      url: `/?group=${groupId}&tab=prayer`,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    praying: data.i_prayed, // (kept for older clients)
    i_prayed: data.i_prayed,
    pray_count: data.pray_count,
  });
}
