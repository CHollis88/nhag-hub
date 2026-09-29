import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withPrivateCache } from "@/lib/cacheHeaders";

// Sermons are church-wide only (no per-group sermons table), so series
// are church-wide too -- same admin-only posting rule as sermons
// themselves.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("sermon_series")
    .select("id, name, color, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // v71 #28: how many sermons each series holds (the "Manage series" sheet
  // shows it, and the delete warning uses it). Admins count drafts too;
  // everyone else counts only what they can see -- published sermons.
  let sermonQuery = supabase.from("sermons").select("series_id").not("series_id", "is", null);
  if (!user.is_church_admin) sermonQuery = sermonQuery.eq("status", "published");
  const { data: inSeries } = await sermonQuery;
  const counts = {};
  for (const row of inSeries || []) counts[row.series_id] = (counts[row.series_id] || 0) + 1;

  return withPrivateCache(
    { series: data.map((s) => ({ ...s, sermon_count: counts[s.id] || 0 })) },
    { maxAge: 60, staleWhileRevalidate: 300 }
  );
}

export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { name, color } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("sermon_series")
    .insert({ name: name.trim(), color: color || null, created_by: user.id })
    .select("id, name, color, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ series: data });
}
