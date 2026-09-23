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

  // ?drafts=1 is the admin-only "Drafts" view -- regular members never
  // see an unpublished sermon, same visibility rule as News drafts.
  const wantDrafts = req.nextUrl.searchParams.get("drafts") === "1";
  if (wantDrafts && !user.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const supabase = supabaseServer();
  let query = supabase
    .from("sermons")
    .select("id, title, synopsis, speaker, link_url, sermon_date, series_id, series_order, status, created_at, users(display_name), sermon_series(name, color)")
    .order("sermon_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  query = wantDrafts ? query.eq("status", "draft") : query.eq("status", "published");

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

  const { title, synopsis, speaker, link_url, sermon_date, series_id, series_order, status, notify } = await req.json();
  if (!title?.trim() || !synopsis?.trim()) {
    return NextResponse.json({ error: "title and synopsis are required." }, { status: 400 });
  }
  const finalStatus = status === "draft" ? "draft" : "published";
  const shouldNotify = notify !== false;

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
      status: finalStatus,
      created_by: user.id,
    })
    .select("id, title, synopsis, speaker, link_url, sermon_date, series_id, series_order, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // A draft never notifies -- there's nothing to announce until it's
  // actually published.
  if (finalStatus === "draft") {
    return NextResponse.json({ sermon: data });
  }

  if (shouldNotify) {
    notifyGlobal({
      title: "New Sermon",
      body: speaker?.trim() ? `${title.trim()} — ${speaker.trim()}` : title.trim(),
      url: "/?tab=sermons",
    }).catch(() => {});
  }

  return NextResponse.json({ sermon: data });
}
