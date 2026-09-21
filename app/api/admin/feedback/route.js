import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withPrivateCache } from "@/lib/cacheHeaders";

// Admin-only queue. Anonymous submissions have created_by stripped
// server-side here too, same pattern as anonymous prayer requests --
// the row still stores it (traceable at the DB level if ever needed
// for abuse), but the API response never exposes who wrote an
// anonymous one.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const onlyUnresolved = req.nextUrl.searchParams.get("resolved") !== "1";

  const supabase = supabaseServer();
  let query = supabase
    .from("feedback")
    .select("id, group_id, is_anonymous, message, resolved, created_by, created_at, users!created_by(display_name), groups(name)")
    .order("created_at", { ascending: false });
  if (onlyUnresolved) query = query.eq("resolved", false);
  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sanitized = data.map((f) => ({
    ...f,
    users: f.is_anonymous ? null : f.users,
    created_by: f.is_anonymous ? null : f.created_by,
  }));

  return withPrivateCache({ feedback: sanitized }, { maxAge: 20, staleWhileRevalidate: 60 });
}
