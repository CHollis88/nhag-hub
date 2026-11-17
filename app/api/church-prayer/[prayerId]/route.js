import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { churchPrayerOffResponse } from "@/lib/churchPrayer";
import { logActivity } from "@/lib/activityLog";

// Editing: only the person who wrote it (same rule as ministry prayer --
// nobody edits someone else's words). Removing: the author, or a Church
// Admin (moderation).
export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const off = await churchPrayerOffResponse();
  if (off) return off;

  const { prayerId } = await params;
  const { body } = await req.json().catch(() => ({}));
  const text = String(body || "").trim();
  if (!text) return NextResponse.json({ error: "A prayer request can't be empty." }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "Keep it under 2000 characters." }, { status: 400 });

  const supabase = supabaseServer();
  const { data: prayer, error: fetchError } = await supabase.from("global_prayer").select("created_by").eq("id", prayerId).maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!prayer) return NextResponse.json({ error: "Prayer request not found." }, { status: 404 });
  if (prayer.created_by !== user.id) return NextResponse.json({ error: "You can only edit your own prayer requests." }, { status: 403 });

  const { data, error } = await supabase.from("global_prayer").update({ body: text }).eq("id", prayerId).select("id, body").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prayer: data });
}

export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { prayerId } = await params;
  const supabase = supabaseServer();
  const { data: prayer, error: fetchError } = await supabase
    .from("global_prayer")
    .select("id, created_by")
    .eq("id", prayerId)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!prayer) return NextResponse.json({ error: "Prayer request not found." }, { status: 404 });

  const isOwner = prayer.created_by === user.id;
  if (!isOwner && !user.is_church_admin) {
    return NextResponse.json({ error: "You can only remove your own prayer requests." }, { status: 403 });
  }

  const { error } = await supabase.from("global_prayer").delete().eq("id", prayerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("post_reactions").delete().eq("post_type", "global_prayer").eq("post_id", prayerId);
  if (!isOwner) logActivity(user.id, "church_prayer_removed", `${user.display_name || "An admin"} removed a church prayer request`);
  return NextResponse.json({ ok: true });
}
