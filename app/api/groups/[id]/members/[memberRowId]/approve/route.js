import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";
import { invalidateUserSessions } from "@/lib/session";
import { logActivity } from "@/lib/activityLog";

export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id: groupId, memberRowId } = await params;
  const allowed = await canManageGroup(user, groupId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can approve join requests." },
      { status: 403 }
    );
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_members")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", memberRowId)
    .eq("group_id", groupId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: "Pending request not found." }, { status: 404 });
  }
  invalidateUserSessions(data.user_id);
  logMembershipDecision(supabase, user, "approved", data.user_id, groupId);
  return NextResponse.json({ member: data });
}

// v71 #26: "Cam approved Taylor's request to join Choir" in the activity log.
// Best-effort and never blocks the response.
async function logMembershipDecision(supabase, actor, verb, targetUserId, groupId) {
  try {
    const [{ data: target }, { data: group }] = await Promise.all([
      supabase.from("users").select("display_name").eq("id", targetUserId).maybeSingle(),
      supabase.from("groups").select("name").eq("id", groupId).maybeSingle(),
    ]);
    logActivity(
      actor.id,
      `join_request_${verb}`,
      `${actor.display_name} ${verb} ${target?.display_name || "a member"}'s request to join ${group?.name || "a ministry"}`,
      { group_id: groupId, target_user_id: targetUserId }
    );
  } catch {
    // logging is best-effort
  }
}
