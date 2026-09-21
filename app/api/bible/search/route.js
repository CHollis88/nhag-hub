import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { searchKjv, searchDictionary } from "@/lib/bible";
import { withNoStore } from "@/lib/cacheHeaders";

// One search box across everything Bible-related: the KJV text itself,
// the user's own notes and tags, and the dictionary/glossary lookups
// Concordance already indexes. Personalized (includes the user's own
// notes/tags), so this is always no-store rather than cached -- same
// reasoning as every other per-user Bible endpoint.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q is required." }, { status: 400 });

  const passages = searchKjv(q, { limit: 25 });
  const dictionary = searchDictionary(q);

  const supabase = supabaseServer();
  const { data: notes } = await supabase
    .from("bible_notes")
    .select("id, book, chapter, verse_start, verse_end, text")
    .eq("user_id", user.id)
    .ilike("text", `%${q}%`)
    .limit(10);

  const { data: tags } = await supabase
    .from("bible_tags")
    .select("id, book, chapter, verse_start, verse_end, tag")
    .eq("user_id", user.id)
    .ilike("tag", `%${q}%`)
    .limit(10);

  return withNoStore({
    passages,
    dictionary,
    notes: notes || [],
    tags: tags || [],
  });
}
