import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isActiveGroupMember } from "@/lib/groupAuth";
import { notifyGroup } from "@/lib/push";
import { withPrivateCache } from "@/lib/cacheHeaders";

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_prayer")
    .select("id, body, is_anonymous, pray_count, created_by, created_at, users!created_by(display_name)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: myPrayed } = await supabase
    .from("group_prayer_supporters")
    .select("prayer_id")
    .eq("user_id", user.id);
  const prayedIds = new Set((myPrayed || []).map((p) => p.prayer_id));

  // Strip the submitter's name server-side for anonymous requests, so it
  // never even reaches the client -- not just hidden in the UI.
  // is_mine is computed from the real created_by before it's nulled out
  // below -- so the owner of an anonymous request can still see their
  // own Edit/Remove controls, without the client ever learning WHO wrote
  // anyone else's anonymous request. Without this, the owner's own
  // created_by looks identical to everyone else's (null), and the
  // ownership check silently never matches even for the actual owner.
  const sanitized = data.map((p) => ({
    ...p,
    is_mine: p.created_by === user.id,
    users: p.is_anonymous ? null : p.users,
    created_by: p.is_anonymous ? null : p.created_by,
    i_prayed: prayedIds.has(p.id),
  }));

  return withPrivateCache({ prayer: sanitized });
}

// Unlike News/Events, any active member can submit a prayer request --
// per the permission matrix, this is the one piece of content Members
// create themselves.
export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const { body, is_anonymous } = await req.json();
  if (!body?.trim()) {
    return NextResponse.json({ error: "Prayer request can't be empty." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_prayer")
    .insert({ group_id: groupId, body: body.trim(), is_anonymous: Boolean(is_anonymous), created_by: user.id })
    .select("id, body, is_anonymous, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Deliberately generic -- a prayer request's content shouldn't show up
  // in a lock-screen notification banner, even for a non-anonymous one.
  notifyGroup(groupId, { title: "New Prayer Request", body: "Tap to view.", url: "/" }).catch(() => {});

  return NextResponse.json({ prayer: data });
}
