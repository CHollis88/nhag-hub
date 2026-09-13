import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("reading_progress")
    .select("day, prayed, read, meditated, updated_at")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byDay = {};
  for (const row of data) {
    byDay[row.day] = { p: row.prayed, r: row.read, m: row.meditated, at: row.updated_at };
  }
  return NextResponse.json({ progress: byDay });
}

export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { day, p, r, m } = await req.json();
  if (day == null) {
    return NextResponse.json({ error: "day is required." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("reading_progress").upsert(
    {
      user_id: user.id,
      day,
      prayed: !!p,
      read: !!r,
      meditated: !!m,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,day" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
