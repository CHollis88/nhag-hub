import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyGlobal } from "@/lib/push";
import { withPrivateCache } from "@/lib/cacheHeaders";

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("sermons")
    .select("id, title, synopsis, speaker, link_url, sermon_date, created_at, users(display_name)")
    .order("sermon_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return withPrivateCache({ sermons: data });
}

// Admin-only to post -- same as the rest of church-wide content (there's
// no distinct "pastor" role in the permission model, so this follows the
// same rule as the Pastor's Message News category).
export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { title, synopsis, speaker, link_url, sermon_date } = await req.json();
  if (!title?.trim() || !synopsis?.trim()) {
    return NextResponse.json({ error: "title and synopsis are required." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("sermons")
    .insert({
      title: title.trim(),
      synopsis: synopsis.trim(),
      speaker: speaker?.trim() || null,
      link_url: link_url?.trim() || null,
      sermon_date: sermon_date || null,
      created_by: user.id,
    })
    .select("id, title, synopsis, speaker, link_url, sermon_date, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  notifyGlobal({
    title: "New Sermon",
    body: speaker?.trim() ? `${title.trim()} — ${speaker.trim()}` : title.trim(),
    url: "/",
  }).catch(() => {});

  return NextResponse.json({ sermon: data });
}
