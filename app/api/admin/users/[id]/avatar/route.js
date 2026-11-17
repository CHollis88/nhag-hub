import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { avatarPathFromUrl } from "@/lib/avatars";
import { logActivity } from "@/lib/activityLog";

// A Church Admin removes someone's profile photo (e.g. an inappropriate one).
export async function DELETE(req, { params }) {
  const admin = await getCurrentUser(req);
  if (!admin?.is_church_admin) return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  const { id } = await params;

  const supabase = supabaseServer();
  const { data: target, error } = await supabase.from("users").select("display_name, avatar_url").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "Person not found." }, { status: 404 });

  const { error: updateError } = await supabase.from("users").update({ avatar_url: null }).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  const oldPath = avatarPathFromUrl(target.avatar_url);
  if (oldPath) await supabase.storage.from("avatars").remove([oldPath]);

  logActivity(admin.id, "avatar_removed", `${admin.display_name || "An admin"} removed ${target.display_name || "someone"}'s profile photo`);
  return NextResponse.json({ ok: true });
}
