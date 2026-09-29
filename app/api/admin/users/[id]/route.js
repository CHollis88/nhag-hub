import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { logActivity } from "@/lib/activityLog";
import { invalidateUserSessions, deleteAllSessionsForUser } from "@/lib/session";
import { accountImpact, accountDeletionReady, NEEDS_MIGRATION_036 } from "@/lib/accountImpact";
import { requireRecentPin } from "@/lib/adminAuth";

export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { id } = await params;
  const { is_church_admin } = await req.json();
  if (typeof is_church_admin !== "boolean") {
    return NextResponse.json({ error: "is_church_admin must be true or false." }, { status: 400 });
  }

  // Guard against an admin accidentally locking themselves out with no
  // one left to undo it -- removing your OWN access needs someone else
  // to do it, same idea as not being able to fire yourself.
  if (id === user.id && !is_church_admin) {
    return NextResponse.json(
      { error: "You can't remove your own admin access. Have another admin do this." },
      { status: 400 }
    );
  }

  // v71 #21: changing who has power asks for the PIN again.
  const pinNeeded = requireRecentPin(user);
  if (pinNeeded) return pinNeeded;

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("users")
    .update({ is_church_admin, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, username, display_name, is_church_admin")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  invalidateUserSessions(id);
  logActivity(
    user.id,
    is_church_admin ? "admin_promoted" : "admin_demoted",
    is_church_admin
      ? `${user.display_name} made ${data.display_name} (@${data.username}) a Church Admin`
      : `${user.display_name} removed ${data.display_name}'s (@${data.username}) Church Admin access`,
    { target_user_id: data.id, target_username: data.username }
  );
  return NextResponse.json({ user: data });
}

// v71 -- permanently delete an ACCOUNT. Admin only, and the most guarded
// thing in the app:
//   * asks for the PIN again (like granting admin or deleting a ministry);
//   * you can't delete yourself;
//   * an admin can't be deleted directly -- remove their admin access first
//     (which itself needs the PIN), so nobody is deleted by a single slip;
//   * every session is ended first, and the deletion is written to the log
//     with what it removed.
// What goes and what stays is decided by the database's foreign keys
// (migration_036) and mirrored by lib/accountImpact.js: their private data is
// deleted (direct messages, journal, notes, RSVPs, memberships...), while
// shared content stays with a blank author, shown as "Former member".
export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { id } = await params;
  if (id === user.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: target, error: lookupError } = await supabase
    .from("users")
    .select("id, username, display_name, is_church_admin")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  if (target.is_church_admin) {
    return NextResponse.json(
      { error: `${target.display_name} is a Church Admin. Remove their admin access first, then delete the account.`, code: "target_is_admin" },
      { status: 409 }
    );
  }

  // Refuse BEFORE asking for a PIN: without migration_036 the database would
  // also delete this person's chat messages (see lib/accountImpact.js).
  if (!(await accountDeletionReady(supabase))) {
    return NextResponse.json({ error: NEEDS_MIGRATION_036, code: "needs_migration" }, { status: 500 });
  }

  const pinNeeded = requireRecentPin(user);
  if (pinNeeded) return pinNeeded;

  const impact = await accountImpact(supabase, id); // for the log line, taken before anything is removed

  await deleteAllSessionsForUser(id);
  const { error: deleteError } = await supabase.from("users").delete().eq("id", id);
  invalidateUserSessions(id);
  if (deleteError) {
    return NextResponse.json({ error: `Couldn't delete the account: ${deleteError.message}` }, { status: 500 });
  }

  logActivity(
    user.id,
    "account_deleted",
    `${user.display_name} permanently deleted ${target.display_name}'s (@${target.username}) account`,
    { deleted_user_id: id, deleted_username: target.username, ...impact }
  );
  return NextResponse.json({ ok: true });
}
