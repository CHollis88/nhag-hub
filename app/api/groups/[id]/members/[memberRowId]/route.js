import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";

// Removes an active member (loses all access to this group's content
// immediately, per the project's decision) OR rejects a pending join
// request. Same endpoint for both since it's the same underlying action —
// delete the relationship row.
export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id: groupId, memberRowId } = await params;
  const allowed = await canManageGroup(user, groupId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can remove members." },
      { status: 403 }
    );
  }

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("id", memberRowId)
    .eq("group_id", groupId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Promote a member to leader, or demote a leader back to member, within
// this same group. Does not touch status — only ever called on active rows
// in practice, but doesn't hard-require it in case a leader wants to
// pre-set the role before approving (edge case, harmless either way).
export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id: groupId, memberRowId } = await params;
  const allowed = await canManageGroup(user, groupId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can change roles." },
      { status: 403 }
    );
  }

  const { role } = await req.json();
  if (!["leader", "member"].includes(role)) {
    return NextResponse.json({ error: "role must be 'leader' or 'member'." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_members")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", memberRowId)
    .eq("group_id", groupId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Member row not found." }, { status: 404 });
  return NextResponse.json({ member: data });
}
