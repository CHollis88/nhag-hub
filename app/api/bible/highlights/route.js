import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";

// Adapted from the Young Adults app's device_id version -- same table
// shape and behavior, but keyed to a real signed-in user.id instead of an
// anonymous device_id passed in by the client. The identity now comes
// from the session cookie, not a query param, so nobody can pass someone
// else's ID and read their highlights.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const book = req.nextUrl.searchParams.get("book");
  const chapter = req.nextUrl.searchParams.get("chapter");

  const supabase = supabaseServer();
  let query = supabase
    .from("bible_highlights")
    .select("id, book, chapter, verse_start, verse_end, start_pos, end_pos, color, created_at")
    .eq("user_id", user.id);

  if (book && chapter) {
    query = query.eq("book", book).eq("chapter", chapter);
  }
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return withNoStore({ highlights: data });
}

export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { book, chapter, verse_start, verse_end, start_pos, end_pos, color } = await req.json();
  if (!book || chapter == null || verse_start == null || verse_end == null || start_pos == null || end_pos == null) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("bible_highlights")
    .insert({
      user_id: user.id,
      book,
      chapter,
      verse_start,
      verse_end,
      start_pos,
      end_pos,
      color: color || "yellow",
    })
    .select("id, verse_start, verse_end, start_pos, end_pos, color")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ highlight: data });
}

export async function DELETE(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const supabase = supabaseServer();
  const { error } = await supabase.from("bible_highlights").delete().eq("id", id).eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
