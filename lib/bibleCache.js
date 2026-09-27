import { supabaseServer } from "@/lib/supabaseServer";
import { PASSAGE_FORMAT_VERSION } from "@/lib/bibleTranslations";

// Server-only cache for chapters fetched from external translation
// providers. See migration_032 for the schema and the full reasoning;
// the short version:
//
//   * Both Crossway (ESV) and Tyndale (NLT) allow 5,000 requests/day
//     on their free non-commercial tiers, counted separately, so this
//     is a latency optimization rather than a quota necessity. If the
//     table were emptied tomorrow, nothing would break.
//
//   * The cache is deliberately BOUNDED and EXPIRING. Publishers push
//     text corrections, so infinite retention would serve stale
//     scripture. And an unbounded cache would slowly accumulate into a
//     complete local copy of a licensed translation, which is the
//     thing these licences don't allow. Keep it a cache, not a library.
//
//   * ESV is excluded entirely -- see NEVER_CACHE below.

const TTL_DAYS = 30;
const MAX_ROWS_PER_TRANSLATION = 300;

// Translations that must never be written to the cache.
//
// Crossway caps local storage of the ESV at 500 verses -- roughly a
// dozen chapters -- which is far below any cache size worth having.
// Rather than pretend a 300-chapter cache fits inside that, ESV is
// fetched live on every request. Crossway allows 5,000 requests/day,
// so this costs a little latency and nothing else. Do not "optimize"
// by removing this.
const NEVER_CACHE = new Set(["esv"]);

/** Returns { verses, headings, footnotes, copyright } if a fresh row
 * exists, else null. */
export async function getCachedChapter(translation, book, chapter) {
  if (NEVER_CACHE.has(translation)) return null;
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("bible_chapter_cache")
    .select("id, verses, headings, footnotes, copyright, fetched_at")
    .eq("translation", translation)
    .eq("book", book)
    .eq("chapter", chapter)
    .maybeSingle();

  if (error || !data) return null;

  // Written by an older parser (or before versioning existed)? Treat it
  // as a miss so the chapter is re-fetched and re-parsed. The version is
  // stored inside the headings JSON under "_pv" -- a key no verse number
  // can collide with -- so this needed no schema change.
  if (!data.headings || data.headings._pv !== PASSAGE_FORMAT_VERSION) return null;

  const ageMs = Date.now() - new Date(data.fetched_at).getTime();
  if (ageMs > TTL_DAYS * 24 * 60 * 60 * 1000) {
    // Expired. Drop it and let the caller re-fetch.
    await supabase.from("bible_chapter_cache").delete().eq("id", data.id);
    return null;
  }

  // Touch for LRU. Fire-and-forget: a failed touch costs us a slightly
  // worse eviction decision later, never a failed read for the user.
  supabase
    .from("bible_chapter_cache")
    .update({ last_read_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {}, () => {});

  return {
    verses: data.verses,
    headings: (({ _pv, ...rest }) => rest)(data.headings || {}),
    footnotes: data.footnotes || {},
    copyright: data.copyright,
  };
}

/**
 * Store a freshly-fetched chapter, then evict down to the cap.
 * Never throws -- a cache write failing should cost a future API call,
 * not the response the user is waiting on.
 */
export async function putCachedChapter(translation, book, chapter, verses, copyright, headings = {}, footnotes = {}) {
  if (NEVER_CACHE.has(translation)) return;
  try {
    const supabase = supabaseServer();
    const now = new Date().toISOString();

    await supabase.from("bible_chapter_cache").upsert(
      {
        translation,
        book,
        chapter,
        verses,
        headings: { ...headings, _pv: PASSAGE_FORMAT_VERSION },
        footnotes,
        copyright,
        fetched_at: now,
        last_read_at: now,
      },
      { onConflict: "translation,book,chapter" }
    );

    await evictIfOverCap(translation);
  } catch {
    // Intentionally silent -- see docstring.
  }
}

/** LRU eviction, keeping this translation at or under the cap. */
async function evictIfOverCap(translation) {
  const supabase = supabaseServer();
  const { count } = await supabase
    .from("bible_chapter_cache")
    .select("id", { count: "exact", head: true })
    .eq("translation", translation);

  if (!count || count <= MAX_ROWS_PER_TRANSLATION) return;

  const overBy = count - MAX_ROWS_PER_TRANSLATION;
  const { data: stale } = await supabase
    .from("bible_chapter_cache")
    .select("id")
    .eq("translation", translation)
    .order("last_read_at", { ascending: true })
    .limit(overBy);

  if (stale?.length) {
    await supabase
      .from("bible_chapter_cache")
      .delete()
      .in("id", stale.map((r) => r.id));
  }
}
