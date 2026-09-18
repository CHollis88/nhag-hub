import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";
import { getPlan, DEFAULT_PLAN_ID } from "@/lib/planRegistry";
import { withNoStore } from "@/lib/cacheHeaders";

// Leader/admin-only view of how the whole class is doing on the Bible
// Plan -- mirrors the Young Adults app's own "Group Progress" screen.
// Each member's applicable plan is resolved the same way GroupShell
// resolves it for that member: the group's locked plan if locked,
// otherwise their own personal choice -- so a percentage is always
// relative to the plan that person is actually on, not a plan mismatch.
export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json({ error: "Only this group's leaders or a Church Admin can view group progress." }, { status: 403 });
  }

  const supabase = supabaseServer();

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("reading_plan_locked, reading_plan_id")
    .eq("id", groupId)
    .maybeSingle();
  if (groupError) return NextResponse.json({ error: groupError.message }, { status: 500 });
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("user_id, users(display_name, active_reading_plan)")
    .eq("group_id", groupId)
    .eq("status", "active");
  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 });

  const userIds = members.map((m) => m.user_id);
  if (userIds.length === 0) return withNoStore({ roster: [] });

  const { data: progressRows, error: progressError } = await supabase
    .from("reading_progress")
    .select("user_id, plan_id, prayed, read, meditated")
    .in("user_id", userIds);
  if (progressError) return NextResponse.json({ error: progressError.message }, { status: 500 });

  const roster = members
    .map((m) => {
      const planId = group.reading_plan_locked
        ? group.reading_plan_id || DEFAULT_PLAN_ID
        : m.users?.active_reading_plan || DEFAULT_PLAN_ID;
      const plan = getPlan(planId);
      const doneCount = progressRows.filter(
        (p) => p.user_id === m.user_id && p.plan_id === planId && p.prayed && p.read && p.meditated
      ).length;
      return {
        userId: m.user_id,
        name: m.users?.display_name || "Unknown",
        planName: plan.name,
        doneCount,
        totalDays: plan.TOTAL_READING_DAYS,
      };
    })
    .sort((a, b) => b.doneCount - a.doneCount);

  // Short TTL -- this is a leader checking on their class's progress,
  // wants it current, same reasoning as /api/me and the pending queue.
  return withNoStore({ roster, planLocked: group.reading_plan_locked });
}
