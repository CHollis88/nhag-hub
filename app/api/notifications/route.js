import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";
import { pageParams, trimPage } from "@/lib/pagination";

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  // v71 #44: 50 at a time, newest first; `before` = the created_at of the
  // oldest one already shown, to get the next page down.
  const { limit, before, error: pageError } = pageParams(req.nextUrl.searchParams);
  if (pageError) return NextResponse.json({ error: pageError }, { status: 400 });

  const supabase = supabaseServer();
  let query = supabase
    .from("notifications")
    .select("id, title, body, url, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { rows, hasMore } = trimPage(data, limit);
  // Never cached -- notifications must always reflect the true current
  // state (unread count, latest items) rather than a stale browser copy.
  return withNoStore({ notifications: rows, has_more: hasMore });
}
