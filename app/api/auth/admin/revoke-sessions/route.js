import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteAllSessionsForUser } from "@/lib/session";
import { requireRecentPin } from "@/lib/adminAuth";
import { logActivity } from "@/lib/activityLog";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req) {
  const admin = await getCurrentUser(req);
  if (!admin?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { user_id } = await req.json();
  if (!user_id) {
    return NextResponse.json({ error: "user_id is required." }, { status: 400 });
  }

  // v71 #21: signing someone out everywhere asks for the PIN again.
  const pinNeeded = requireRecentPin(admin);
  if (pinNeeded) return pinNeeded;

  const { data: target } = await supabaseServer().from("users").select("display_name, username").eq("id", user_id).maybeSingle();
  await deleteAllSessionsForUser(user_id);
  logActivity(
    admin.id,
    "sessions_revoked",
    `${admin.display_name} signed ${target?.display_name || "a member"}${target?.username ? ` (@${target.username})` : ""} out on every device`,
    { target_user_id: user_id }
  );
  return NextResponse.json({ ok: true });
}
