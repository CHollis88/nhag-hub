import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";
import { accountImpact, accountDeletionReady, NEEDS_MIGRATION_036 } from "@/lib/accountImpact";

// What permanently deleting this account would remove and what would stay.
// Admin only. Read-only, so no PIN.
export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });

  const { id } = await params;
  const supabase = supabaseServer();
  const { data: target, error } = await supabase.from("users").select("id, display_name, username, is_church_admin").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  // Don't show a warning for something that can't safely be done yet.
  if (!(await accountDeletionReady(supabase))) {
    return NextResponse.json({ error: NEEDS_MIGRATION_036, code: "needs_migration" }, { status: 500 });
  }

  return withNoStore({
    user: { id: target.id, display_name: target.display_name, username: target.username, is_church_admin: Boolean(target.is_church_admin) },
    ...(await accountImpact(supabase, id)),
  });
}
