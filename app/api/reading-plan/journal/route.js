import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withPrivateCache } from "@/lib/cacheHeaders";

// Journal entries are private and only ever looked up by the signed-in
// user's own session. No leader view exists for this data anywhere in
// the app, by design -- same as the Young Adults app it came from.
// plan_id scopes entries to a specific plan, same reasoning as progress.

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const planId = new URL(req.url).searchParams.get("plan_id") || "foundations";

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("day, text")
    .eq("user_id", user.id)
    .eq("plan_id", planId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byDay = {};
  for (const row of data) byDay[row.day] = row.text;
  // Short TTL -- this is the user's own read-your-own-write data (marked
  // today's entry, expects to see it immediately), same reasoning as
  // /api/me: freshness matters more than cache-hit-rate here.
  return withPrivateCache({ journal: byDay }, { maxAge: 20, staleWhileRevalidate: 60 });
}

export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { day, text, plan_id } = await req.json();
  if (day == null) {
    return NextResponse.json({ error: "day is required." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("journal_entries").upsert(
    { user_id: user.id, plan_id: plan_id || "foundations", day, text: text || "", updated_at: new Date().toISOString() },
    { onConflict: "user_id,plan_id,day" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
