import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

// plan_id scopes progress to a specific plan -- see migration_014/016 --
// so switching plans (or being in a locked group on a different plan)
// never overwrites or hides progress on another plan. Defaults to
// 'foundations' for any caller that doesn't pass one, matching every
// row's existing default from before multiple plans existed.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const planId = new URL(req.url).searchParams.get("plan_id") || "foundations";

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("reading_progress")
    .select("day, prayed, read, meditated, updated_at")
    .eq("user_id", user.id)
    .eq("plan_id", planId);

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

  const { day, p, r, m, plan_id } = await req.json();
  if (day == null) {
    return NextResponse.json({ error: "day is required." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("reading_progress").upsert(
    {
      user_id: user.id,
      plan_id: plan_id || "foundations",
      day,
      prayed: !!p,
      read: !!r,
      meditated: !!m,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,plan_id,day" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
