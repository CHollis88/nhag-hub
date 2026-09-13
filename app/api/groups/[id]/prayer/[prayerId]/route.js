import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";

// Either the person who submitted it, or this group's leader/admin
// (moderation), can remove a prayer request. No one else.
export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, prayerId } = await params;
  const supabase = supabaseServer();

  const { data: prayer, error: fetchError } = await supabase
    .from("group_prayer")
    .select("id, created_by")
    .eq("id", prayerId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!prayer) return NextResponse.json({ error: "Prayer request not found." }, { status: 404 });

  const isOwner = prayer.created_by === user.id;
  const canModerate = await canManageGroup(user, groupId);
  if (!isOwner && !canModerate) {
    return NextResponse.json({ error: "You can only remove your own prayer requests." }, { status: 403 });
  }

  const { error } = await supabase.from("group_prayer").delete().eq("id", prayerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
