import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { logActivity } from "@/lib/activityLog";
import { isMissingColumn } from "@/lib/compat";

// v71 -- "Admin notifications": turn OFF the admin-duty notifications (join
// requests, feedback, promotion requests) for yourself. It's for someone who
// holds the admin role for the authority but doesn't want the alerts.
//
// It never changes the role or any permission, and the Needs attention list
// and badge still show. Turning them off is harmless and turning them back on
// is just as harmless, so neither asks for a PIN. Anyone who HOLDS the admin
// role can use it, even with Admin Privileges switched off on this device.
export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!user.has_admin_role) return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });

  const { enabled } = await req.json().catch(() => ({}));
  if (typeof enabled !== "boolean") return NextResponse.json({ error: "enabled must be true or false." }, { status: 400 });

  const { error } = await supabaseServer().from("users").update({ admin_notifications_enabled: enabled }).eq("id", user.id);
  if (error) {
    return NextResponse.json(
      { error: isMissingColumn(error) ? "This needs a database update that hasn't been applied yet (v71 migration 036)." : error.message },
      { status: 500 }
    );
  }
  logActivity(user.id, "admin_notifications_changed", `${user.display_name} turned their admin notifications ${enabled ? "on" : "off"}`);
  return NextResponse.json({ ok: true, admin_notifications_enabled: enabled });
}
