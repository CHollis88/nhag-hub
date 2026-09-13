import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";

export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id: groupId, memberRowId } = await params;
  const allowed = await canManageGroup(user, groupId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can approve join requests." },
      { status: 403 }
    );
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_members")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", memberRowId)
    .eq("group_id", groupId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: "Pending request not found." }, { status: 404 });
  }
  return NextResponse.json({ member: data });
}
