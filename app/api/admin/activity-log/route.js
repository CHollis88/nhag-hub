import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";
import { withColumnFallback } from "@/lib/compat";
import { formatActivityEntry } from "@/lib/activityFormat";

const PAGE = 50;

// v71 #26: entries come back as readable sentences, newest first, with the
// raw fields alongside for the expandable detail. Paged with `before`
// (an ISO timestamp -- the created_at of the last entry already shown) so the
// log doesn't have to load everything (#44).
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const before = req.nextUrl.searchParams.get("before");
  const supabase = supabaseServer();
  const run = (cols) => {
    let q = supabase.from("admin_activity_log").select(cols).order("created_at", { ascending: false }).limit(PAGE + 1);
    if (before) q = q.lt("created_at", before);
    return q;
  };
  const { data, error } = await withColumnFallback(
    () => run("id, action, details, meta, created_at, users(display_name)"),
    () => run("id, action, details, created_at, users(display_name)")
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hasMore = data.length > PAGE;
  const entries = data.slice(0, PAGE).map(formatActivityEntry);
  // Short TTL -- an admin checking the log right after taking an action
  // wants to see it reflected, not a stale minute-old snapshot.
  return withNoStore({ entries, has_more: hasMore });
}
