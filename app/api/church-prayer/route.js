import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";
import { churchPrayerOffResponse } from "@/lib/churchPrayer";
import { withAvatars } from "@/lib/avatars";

// Church-wide prayer requests: every signed-in member can read them and add
// one. No notifications are sent for these (by design: a church-wide
// request pinging everyone would get noisy fast); people see new ones from
// the "new" dot on Home's Church prayer card.
const MAX_LENGTH = 2000;

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const off = await churchPrayerOffResponse();
  if (off) return off;

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("global_prayer")
    .select("id, body, is_anonymous, pray_count, status, status_updated_at, created_by, created_at, users!created_by(display_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data || []).map((p) => p.id);
  const { data: myPrayed } = ids.length
    ? await supabase.from("global_prayer_supporters").select("prayer_id").eq("user_id", user.id).in("prayer_id", ids)
    : { data: [] };
  const prayedIds = new Set((myPrayed || []).map((p) => p.prayer_id));

  // Same rule as ministry prayer: an anonymous request's author never
  // reaches the browser; is_mine is worked out before it's removed.
  const prayer = (data || []).map((p) => ({
    ...p,
    is_mine: p.created_by === user.id,
    users: p.is_anonymous ? null : p.users,
    created_by: p.is_anonymous ? null : p.created_by,
    i_prayed: prayedIds.has(p.id),
  }));

  return withNoStore({ prayer: await withAvatars(supabase, prayer, (p) => (p.is_anonymous ? null : p.created_by)) });
}

export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const off = await churchPrayerOffResponse();
  if (off) return off;

  const { body, is_anonymous } = await req.json().catch(() => ({}));
  const text = String(body || "").trim();
  if (!text) return NextResponse.json({ error: "Prayer request can't be empty." }, { status: 400 });
  if (text.length > MAX_LENGTH) return NextResponse.json({ error: `Keep it under ${MAX_LENGTH} characters.` }, { status: 400 });

  const { data, error } = await supabaseServer()
    .from("global_prayer")
    .insert({ body: text, is_anonymous: Boolean(is_anonymous), created_by: user.id })
    .select("id, body, is_anonymous, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prayer: data });
}
