import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { logActivity } from "@/lib/activityLog";

export async function POST(req, { params }) {
  const admin = await getCurrentUser(req);
  if (!admin?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { requestId } = await params;
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("group_promotion_requests")
    .update({ status: "rejected", reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("*, groups(name)")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Request not found or already reviewed." }, { status: 404 });
  logActivity(admin.id, "promotion_rejected", data.groups?.name ? `Rejected a request from ${data.groups.name}` : null);
  return NextResponse.json({ request: data });
}
