import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

// Includes its sermons in series order, so the client can render "3 of
// 6" plus next/prev without a second round-trip.
export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id } = await params;
  const supabase = supabaseServer();

  const { data: series, error: seriesError } = await supabase
    .from("sermon_series")
    .select("id, name, color, created_at")
    .eq("id", id)
    .maybeSingle();
  if (seriesError) return NextResponse.json({ error: seriesError.message }, { status: 500 });
  if (!series) return NextResponse.json({ error: "Series not found." }, { status: 404 });

  const { data: sermons, error: sermonsError } = await supabase
    .from("sermons")
    .select("id, title, synopsis, speaker, link_url, sermon_date, series_order")
    .eq("series_id", id)
    .order("series_order", { ascending: true, nullsFirst: false });
  if (sermonsError) return NextResponse.json({ error: sermonsError.message }, { status: 500 });

  return NextResponse.json({ series: { ...series, sermons } });
}

export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { id } = await params;
  const { name, color } = await req.json();
  const updates = {};
  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: "name can't be empty." }, { status: 400 });
    updates.name = name.trim();
  }
  if (color !== undefined) updates.color = color || null;

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("sermon_series")
    .update(updates)
    .eq("id", id)
    .select("id, name, color")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ series: data });
}

// Deleting a series doesn't delete its sermons -- series_id just goes
// back to null on each (on delete set null, migration_030), so the
// sermons themselves stay in the archive, just ungrouped.
export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = supabaseServer();
  const { error } = await supabase.from("sermon_series").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
