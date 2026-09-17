import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { logActivity } from "@/lib/activityLog";

// Admin-only. Lists every group blocked for this specific user
// (migration_029) -- separate from the global `hidden` flag on groups
// itself. Used by the Admin Toolbox's per-user ministry-hiding panel.
export async function GET(req, { params }) {
  const admin = await getCurrentUser(req);
  if (!admin?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { id: userId } = await params;
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("user_hidden_groups")
    .select("group_id")
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ hidden_group_ids: (data || []).map((r) => r.group_id) });
}

// Blocks one ministry for this user. Per Cam's explicit decision: if the
// user is currently an active or pending member of that group, applying
// this ALSO removes that membership -- the point is to prevent the
// person from being in it at all, not just hide it from their browse
// list going forward.
export async function POST(req, { params }) {
  const admin = await getCurrentUser(req);
  if (!admin?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { id: userId } = await params;
  const { group_id } = await req.json();
  if (!group_id) {
    return NextResponse.json({ error: "group_id is required." }, { status: 400 });
  }

  const supabase = supabaseServer();

  const { error: hideError } = await supabase
    .from("user_hidden_groups")
    .upsert({ user_id: userId, group_id, hidden_by: admin.id }, { onConflict: "user_id,group_id" });
  if (hideError) return NextResponse.json({ error: hideError.message }, { status: 500 });

  // Remove any existing membership (active or pending) for this pair --
  // the whole point of this block is that the person isn't in the
  // ministry, not merely that they can't newly discover it.
  await supabase.from("group_members").delete().eq("user_id", userId).eq("group_id", group_id);

  const [{ data: targetUser }, { data: group }] = await Promise.all([
    supabase.from("users").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("groups").select("name").eq("id", group_id).maybeSingle(),
  ]);
  logActivity(
    admin.id,
    "user_ministry_blocked",
    `Blocked ${targetUser?.display_name || "a user"} from "${group?.name || "a ministry"}"`
  );

  return NextResponse.json({ ok: true });
}
