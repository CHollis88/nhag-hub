import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";

// Searches across the user's own Notes (by text) and Tags (by tag name)
// -- the two personal-content types that actually have searchable text.
// Highlights themselves have no text field (they're just a marked verse
// range + color, see migration_004), so a highlight only surfaces here
// if the same passage also has a note or tag attached; that's the
// closest meaningful match to "search my highlights" the schema
// supports, without inventing a new highlight-note field.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q is required." }, { status: 400 });

  const supabase = supabaseServer();

  const { data: notes, error: notesError } = await supabase
    .from("bible_notes")
    .select("id, book, chapter, verse_start, verse_end, text, updated_at")
    .eq("user_id", user.id)
    .ilike("text", `%${q}%`)
    .order("updated_at", { ascending: false });
  if (notesError) return NextResponse.json({ error: notesError.message }, { status: 500 });

  const { data: tags, error: tagsError } = await supabase
    .from("bible_tags")
    .select("id, book, chapter, verse_start, verse_end, tag, created_at")
    .eq("user_id", user.id)
    .ilike("tag", `%${q}%`)
    .order("created_at", { ascending: false });
  if (tagsError) return NextResponse.json({ error: tagsError.message }, { status: 500 });

  return withNoStore({ notes, tags });
}
