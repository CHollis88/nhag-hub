import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";
import { countNeedsAttention } from "@/lib/needsAttention";

// Just the single latest created_at per content type -- cheap enough to
// call on every app load without worrying about cost, unlike fetching
// full lists just to check "is there anything new." Scoped to
// church-wide News, Events, and Sermons -- the three main places
// something new actually gets posted for everyone to see.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();
  const [news, events, sermons, unread] = await Promise.all([
    supabase.from("global_news").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("global_events").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("sermons").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    // The bell badge's unread count rides along (v71 #1) so the client
    // makes one poll instead of two. Count only -- no rows transferred.
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false),
  ]);

  const body = {
    news: news.data?.created_at || null,
    events: events.data?.created_at || null,
    sermons: sermons.data?.created_at || null,
    unread_count: unread.count || 0,
  };
  // v71 #22: the count on the Toolbox entry rides along on the poll the app
  // already makes -- only for an effective admin (a session with Admin
  // Privileges off gets none, and no extra queries).
  if (user.is_church_admin) {
    try {
      body.admin_attention_count = await countNeedsAttention(supabase);
    } catch {
      // the badge is a convenience; never break the poll over it
    }
  }
  return withNoStore(body);
}
