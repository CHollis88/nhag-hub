import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { searchBibleWithTotal, searchDictionary } from "@/lib/bible";
import { searchRemoteTranslation } from "@/lib/bibleProviders";
import { getTranslation } from "@/lib/bibleTranslations";
import { withNoStore } from "@/lib/cacheHeaders";

// One search box across everything Bible-related: the Bible text itself (in
// whichever translation you pick), your own notes and tags, and the
// dictionary/glossary lookups. Personalized (includes your notes/tags), so
// always no-store.
//
// KJV and BSB are stored in the app and searched here. ESV, NLT, NKJV and AMP are
// searched through their publishers' own search services. If a publisher is
// down or out of its daily allowance, the rest of the results still come
// back, with a plain message saying the verse search didn't work.
const LIMIT = 25;

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q is required." }, { status: 400 });
  if (q.length > 200) return NextResponse.json({ error: "That search is too long." }, { status: 400 });

  const asked = (req.nextUrl.searchParams.get("translation") || "kjv").toLowerCase();
  const translation = getTranslation(asked) ? asked : "kjv";

  const supabase = supabaseServer();
  const versesPromise = (async () => {
    if (getTranslation(translation).provider === "local") {
      return searchBibleWithTotal(translation, q, { limit: LIMIT });
    }
    return searchRemoteTranslation(translation, q, { limit: LIMIT });
  })().then(
    (r) => ({ passages: r.passages, total: r.total, fumsToken: r.fumsToken || null, error: null }),
    (err) => {
      console.error(`[bible search] ${translation}:`, err?.message);
      return { passages: [], total: 0, fumsToken: null, error: err?.message || "Verse search didn't work just now." };
    }
  );

  const [verses, notesRes, tagsRes] = await Promise.all([
    versesPromise,
    supabase
      .from("bible_notes")
      .select("id, book, chapter, verse_start, verse_end, text")
      .eq("user_id", user.id)
      .ilike("text", `%${q}%`)
      .limit(10),
    supabase
      .from("bible_tags")
      .select("id, book, chapter, verse_start, verse_end, tag")
      .eq("user_id", user.id)
      .ilike("tag", `%${q}%`)
      .limit(10),
  ]);

  return withNoStore({
    searchedIn: translation,
    passages: verses.passages,
    passagesTotal: verses.total,
    passagesError: verses.error,
    // API.Bible translations: usage token the browser reports (lib/fums.js)
    // and the credit line their licence requires next to the results.
    fumsToken: verses.fumsToken,
    dictionary: searchDictionary(q),
    notes: notesRes.data || [],
    tags: tagsRes.data || [],
  });
}
