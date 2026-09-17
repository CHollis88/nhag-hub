import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyGroup } from "@/lib/push";

// Called on a schedule by Vercel Cron (see vercel.json) -- not meant to be
// hit by a browser. Protected by a shared secret so nobody else can
// trigger it and spam every reading-plan group with pushes on demand.
export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = supabaseServer();
  const { data: groups, error } = await supabase
    .from("groups")
    .select("id, name")
    .contains("features", ["reading_plan_journal"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await Promise.all(
    (groups || []).map((g) =>
      notifyGroup(g.id, {
        title: "Daily Reading Reminder",
        body: "Time for today's reading, prayer, and reflection.",
        url: `/?group=${g.id}&tab=today`,
      })
    )
  );

  return NextResponse.json({ ok: true, groups_notified: groups?.length || 0 });
}
