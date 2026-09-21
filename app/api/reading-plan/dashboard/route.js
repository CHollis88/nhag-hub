import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";

// Total day-counts per plan, matching each plan's actual data file
// length -- used for the "% complete" figure. Kept here rather than
// re-reading the plan JSON files, since only the count is needed.
const PLAN_DAY_COUNTS = {
  foundations: 365,
  whole6mo: 180,
  whole9mo: 270,
  nt90: 90,
};

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const planId = req.nextUrl.searchParams.get("plan_id") || "foundations";

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("reading_progress")
    .select("day, read, prayed, meditated, updated_at")
    .eq("user_id", user.id)
    .eq("plan_id", planId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const completedDays = data.filter((r) => r.read).length;
  const totalDays = PLAN_DAY_COUNTS[planId] || 365;
  const percentComplete = totalDays ? Math.round((completedDays / totalDays) * 100) : 0;

  // Streak: consecutive CALENDAR days (not plan days) with at least one
  // completed activity, counting back from today. Plan day numbers
  // don't map 1:1 to calendar days (someone can catch up or fall
  // behind), so the streak is driven by updated_at, the actual date
  // something was marked done.
  const completedDates = new Set(
    data.filter((r) => r.read || r.prayed || r.meditated).map((r) => new Date(r.updated_at).toISOString().slice(0, 10))
  );

  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!completedDates.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Last 30 calendar days, oldest first, for a simple history chart.
  const history = [];
  const historyCursor = new Date();
  historyCursor.setDate(historyCursor.getDate() - 29);
  for (let i = 0; i < 30; i++) {
    const key = historyCursor.toISOString().slice(0, 10);
    history.push({ date: key, completed: completedDates.has(key) });
    historyCursor.setDate(historyCursor.getDate() + 1);
  }

  return withNoStore({
    plan_id: planId,
    completed_days: completedDays,
    total_days: totalDays,
    percent_complete: percentComplete,
    streak,
    history,
  });
}
