import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { churchPrayerOffResponse } from "@/lib/churchPrayer";

const VALID_STATUSES = ["open", "answered", "still-praying"];

// "Answered" / "Still praying": the person who wrote it, or a Church Admin
// (for a request whose author has stopped using the app). No notification.
export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const off = await churchPrayerOffResponse();
  if (off) return off;

  const { prayerId } = await params;
  const { status } = await req.json().catch(() => ({}));
  if (!VALID_STATUSES.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  const supabase = supabaseServer();
  const { data: prayer, error: fetchError } = await supabase.from("global_prayer").select("created_by").eq("id", prayerId).maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!prayer) return NextResponse.json({ error: "Prayer request not found." }, { status: 404 });
  if (prayer.created_by !== user.id && !user.is_church_admin) {
    return NextResponse.json({ error: "Only the person who shared this request can update it." }, { status: 403 });
  }

  const { error } = await supabase
    .from("global_prayer")
    .update({ status, status_updated_at: new Date().toISOString() })
    .eq("id", prayerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status });
}
