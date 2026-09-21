import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyGlobal } from "@/lib/push";
import { withNoStore } from "@/lib/cacheHeaders";

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const seriesId = req.nextUrl.searchParams.get("series_id");
  const speaker = req.nextUrl.searchParams.get("speaker");

  const supabase = supabaseServer();
  let query = supabase
    .from("sermons")
    .select("id, title, synopsis, speaker, link_url, sermon_date, series_id, series_order, created_at, users(display_name), sermon_series(name, color)")
    .order("sermon_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  // Optional filters for the Archive view -- omitted, this behaves
  // exactly as the original unfiltered list.
  if (seriesId) query = query.eq("series_id", seriesId);
  if (speaker) query = query.ilike("speaker", `%${speaker}%`);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return withNoStore({ sermons: data });
}

// Admin-only to post -- same as the rest of church-wide content (there's
// no distinct "pastor" role in the permission model, so this follows the
// same rule as the Pastor's Message News category).
export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { title, synopsis, speaker, link_url, sermon_date, series_id, series_order } = await req.json();
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
      series_id: series_id || null,
      series_order: Number.isInteger(series_order) ? series_order : null,
      created_by: user.id,
    })
    .select("id, title, synopsis, speaker, link_url, sermon_date, series_id, series_order, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  notifyGlobal({
    title: "New Sermon",
    body: speaker?.trim() ? `${title.trim()} — ${speaker.trim()}` : title.trim(),
        url: "/?tab=sermons",
  }).catch(() => {});

  return NextResponse.json({ sermon: data });
}
