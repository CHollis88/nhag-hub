import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withPrivateCache } from "@/lib/cacheHeaders";

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("admin_activity_log")
    .select("id, action, details, created_at, users(display_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Short TTL -- an admin checking the log right after taking an action
  // wants to see it reflected, not a stale minute-old snapshot.
  return withPrivateCache({ entries: data }, { maxAge: 20, staleWhileRevalidate: 60 });
}
