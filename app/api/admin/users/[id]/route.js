import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { logActivity } from "@/lib/activityLog";

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

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("users")
    .update({ is_church_admin, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, username, display_name, is_church_admin")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logActivity(
    user.id,
    is_church_admin ? "admin_promoted" : "admin_demoted",
    is_church_admin ? `Made @${data.username} an admin` : `Removed @${data.username}'s admin access`
  );
  return NextResponse.json({ user: data });
}
