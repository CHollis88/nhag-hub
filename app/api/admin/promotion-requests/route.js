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
  const { data: requests, error } = await supabase
    .from("group_promotion_requests")
    .select("id, group_id, requested_by, source_type, source_id, status, created_at, groups(name), users!requested_by(display_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach the actual news content for each request so the admin can see
  // what they're approving without a second round trip per item.
  const withContent = await Promise.all(
    requests.map(async (r) => {
      if (r.source_type !== "news") return r;
      const { data: news } = await supabase
        .from("group_news")
        .select("title, body")
        .eq("id", r.source_id)
        .maybeSingle();
      return { ...r, news };
    })
  );

  // Short TTL -- this is an admin's pending-approval queue, same
  // freshness reasoning as the group members pending list.
  return withPrivateCache({ requests: withContent }, { maxAge: 20, staleWhileRevalidate: 60 });
}
