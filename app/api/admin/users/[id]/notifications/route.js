import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { logActivity } from "@/lib/activityLog";
import { isMissingColumn } from "@/lib/compat";

// v71 -- turn another admin's admin-duty notifications on or off. For an
// admin who has the authority but no interest (or ability) to manage the
// alerts: set it once from the Toolbox instead of on their phone. Only
// affects notifications -- their role, permissions and Needs attention list
// are untouched. Not PIN-gated: nothing is lost either way.
export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });

  const { id } = await params;
  const { enabled } = await req.json().catch(() => ({}));
  if (typeof enabled !== "boolean") return NextResponse.json({ error: "enabled must be true or false." }, { status: 400 });

  const supabase = supabaseServer();
  const { data: target } = await supabase.from("users").select("id, display_name, username, is_church_admin").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (!target.is_church_admin) {
    return NextResponse.json({ error: "Only admins receive admin notifications." }, { status: 400 });
  }

  const { error } = await supabase.from("users").update({ admin_notifications_enabled: enabled }).eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: isMissingColumn(error) ? "This needs a database update that hasn't been applied yet (v71 migration 036)." : error.message },
      { status: 500 }
    );
  }
  logActivity(
    user.id,
    "admin_notifications_changed",
    id === user.id
      ? `${user.display_name} turned their admin notifications ${enabled ? "on" : "off"}`
      : `${user.display_name} turned ${target.display_name}'s (@${target.username}) admin notifications ${enabled ? "on" : "off"}`,
    { target_user_id: id }
  );
  return NextResponse.json({ ok: true, admin_notifications_enabled: enabled });
}
