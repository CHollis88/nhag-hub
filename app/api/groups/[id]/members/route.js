import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";

// Any active member of the group can see the roster (per the project's
// decision that members can see who else is in their group). Only a
// leader/admin also gets the pending-approval queue back.
export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id: groupId } = await params;
  const canManage = await canManageGroup(user, groupId);
  const isMember = canManage || (await isActiveGroupMember(user, groupId));

  if (!isMember) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data: active, error: activeError } = await supabase
    .from("group_members")
    .select("id, role, status, user_id, users(id, username, display_name)")
    .eq("group_id", groupId)
    .eq("status", "active");

  if (activeError) return NextResponse.json({ error: activeError.message }, { status: 500 });

  let pending = [];
  if (canManage) {
    const { data: pendingData, error: pendingError } = await supabase
      .from("group_members")
      .select("id, role, status, user_id, users(id, username, display_name)")
      .eq("group_id", groupId)
      .eq("status", "pending");

    if (pendingError) return NextResponse.json({ error: pendingError.message }, { status: 500 });
    pending = pendingData;
  }

  return NextResponse.json({ active, pending: canManage ? pending : undefined });
}

// Leader (own group) or admin adds an EXISTING user directly. Goes straight
// to status='active' — no approval step, since the leader already chose
// this person. Per the project's decision, there's no invite-by-email path
// here: if the person doesn't already have an account, they can't be added.
export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id: groupId } = await params;
  const allowed = await canManageGroup(user, groupId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can add members." },
      { status: 403 }
    );
  }

  const { user_id, role } = await req.json();
  if (!user_id || !["leader", "member"].includes(role)) {
    return NextResponse.json(
      { error: "user_id is required and role must be 'leader' or 'member'." },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_members")
    .upsert(
      { group_id: groupId, user_id, role, status: "active", updated_at: new Date().toISOString() },
      { onConflict: "group_id,user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data });
}
