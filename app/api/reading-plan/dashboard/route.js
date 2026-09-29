import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";
import { localDateOfTimestamp, shiftDate } from "@/lib/localDate";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  // The server runs in UTC, so "today" and each day's boundary come from
  // the client (v71 #3): its local date plus its UTC offset. Without
  // them (an old cached client) fall back to UTC like before.
  const sp = req.nextUrl.searchParams;
  const offsetParam = Number(sp.get("tz_offset"));
  const offsetMinutes = Number.isFinite(offsetParam) && Math.abs(offsetParam) <= 14 * 60 ? offsetParam : 0;
  const todayParam = sp.get("today");
  const today = YMD_RE.test(todayParam || "") ? todayParam : localDateOfTimestamp(new Date().toISOString(), offsetMinutes);

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
    data.filter((r) => r.read || r.prayed || r.meditated).map((r) => localDateOfTimestamp(r.updated_at, offsetMinutes))
  );

  let streak = 0;
  for (let key = today; completedDates.has(key); key = shiftDate(key, -1)) {
    streak += 1;
  }

  // Last 30 calendar days, oldest first, for a simple history chart.
  const history = [];
  for (let i = 29; i >= 0; i--) {
    const key = shiftDate(today, -i);
    history.push({ date: key, completed: completedDates.has(key) });
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
