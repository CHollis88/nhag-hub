import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { logActivity } from "@/lib/activityLog";

// Admin-only. Un-blocks a ministry that was previously hidden from this
// specific user (migration_029). Does NOT restore any membership that
// was removed when the block was applied -- the person is free to
// request to join again like anyone else, same as un-hiding a globally
// hidden ministry doesn't retroactively re-add anyone.
export async function DELETE(req, { params }) {
  const admin = await getCurrentUser(req);
  if (!admin?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { id: userId, groupId } = await params;
  const supabase = supabaseServer();
  const { error } = await supabase
    .from("user_hidden_groups")
    .delete()
    .eq("user_id", userId)
    .eq("group_id", groupId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [{ data: targetUser }, { data: group }] = await Promise.all([
    supabase.from("users").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("groups").select("name").eq("id", groupId).maybeSingle(),
  ]);
  logActivity(
    admin.id,
    "user_ministry_unblocked",
    `Unblocked ${targetUser?.display_name || "a user"} from "${group?.name || "a ministry"}"`
  );

  return NextResponse.json({ ok: true });
}
