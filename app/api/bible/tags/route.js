import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const book = req.nextUrl.searchParams.get("book");
  const chapter = req.nextUrl.searchParams.get("chapter");

  const supabase = supabaseServer();
  let query = supabase
    .from("bible_tags")
    .select("id, book, chapter, verse_start, verse_end, tag, created_at")
    .eq("user_id", user.id);

  if (book && chapter) {
    query = query.eq("book", book).eq("chapter", chapter);
  }
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tags: data });
}

export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { book, chapter, verse_start, verse_end, tag } = await req.json();
  if (!book || chapter == null || verse_start == null || verse_end == null || !tag?.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("bible_tags")
    .insert({
      user_id: user.id,
      book,
      chapter,
      verse_start,
      verse_end,
      tag: tag.trim().toLowerCase(),
    })
    .select("id, verse_start, verse_end, tag, created_at")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tag: data });
}

export async function DELETE(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const supabase = supabaseServer();
  const { error } = await supabase.from("bible_tags").delete().eq("id", id).eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
