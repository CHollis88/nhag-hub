import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

// Admin-only. Unlike /api/users/lookup (deliberately narrow, exact-match
// only, for the "add someone to my group" flow), this genuinely lists
// every account -- but only to a Church Admin, for the specific purpose
// of promoting/demoting admin access.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("users")
    .select("id, username, display_name, is_church_admin")
    .not("username", "is", null)
    .order("display_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}
