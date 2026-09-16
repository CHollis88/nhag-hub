import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

// Self-service leave: any active member (including a leader) can leave
// a group on their own, no leader/admin approval needed. Deliberately
// does NOT block a sole remaining leader from leaving -- Cam's request
// was specifically "members can leave on their own," and adding an
// undiscussed guardrail ("you're the only leader, are you sure?") would
// be scope beyond what was asked. A group with no leaders left is still
// fully manageable by a Church Admin.
//
// Distinct from DELETE /api/groups/[id]/members/[memberRowId], which is
// the leader/admin-only "remove someone else" action -- this route only
// ever touches the caller's own row and has no canManageGroup gate.
export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id: groupId } = await params;
  const supabase = supabaseServer();

  const { data: membership, error: fetchError } = await supabase
    .from("group_members")
    .select("id, status")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!membership) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 404 });
  }

  const { error } = await supabase.from("group_members").delete().eq("id", membership.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
