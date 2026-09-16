import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";

// Just the single latest created_at per content type -- cheap enough to
// call on every app load without worrying about cost, unlike fetching
// full lists just to check "is there anything new." Scoped to
// church-wide News, Events, and Sermons -- the three main places
// something new actually gets posted for everyone to see.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();
  const [news, events, sermons] = await Promise.all([
    supabase.from("global_news").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("global_events").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("sermons").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return withNoStore({
    news: news.data?.created_at || null,
    events: events.data?.created_at || null,
    sermons: sermons.data?.created_at || null,
  });
}
