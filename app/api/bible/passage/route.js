import { NextResponse } from "next/server";
import { isValidBook, getKjvChapter, getPericopes } from "@/lib/bible";
import { withPublicCache } from "@/lib/cacheHeaders";
import { getTranslation, DEFAULT_TRANSLATION } from "@/lib/bibleTranslations";
import { fetchRemoteChapter } from "@/lib/bibleProviders";
import { getCachedChapter, putCachedChapter } from "@/lib/bibleCache";

// Serves one chapter in one translation.
//
// KJV comes off local disk (instant, no quota, carries Strong's).
// Everything else goes: Supabase cache -> provider API -> Supabase
// cache. See lib/bibleCache.js for why that cache is bounded.

export async function GET(req) {
  const book = req.nextUrl.searchParams.get("book");
  const chapter = req.nextUrl.searchParams.get("chapter");
  const translationId = req.nextUrl.searchParams.get("translation") || DEFAULT_TRANSLATION;

  if (!book || !chapter || !isValidBook(book)) {
    return NextResponse.json({ error: "A valid book and chapter are required." }, { status: 400 });
  }

  const translation = getTranslation(translationId);
  if (!translation) {
    return NextResponse.json({ error: "Unknown translation." }, { status: 400 });
  }

  // Section headings are our own data, keyed by book/chapter/verse, so
  // they apply regardless of which translation's words are shown.
  const headings = getPericopes(book, chapter);

  if (translation.provider === "local") {
    const verses = getKjvChapter(book, chapter);
    if (!verses) return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
    return withPublicCache({
      book,
      chapter,
      translation: translation.id,
      supportsStrongs: true,
      verses,
      headings,
      copyright: null,
    });
  }

  const cached = await getCachedChapter(translation.id, book, chapter);
  if (cached) {
    return withPublicCache({
      book,
      chapter,
      translation: translation.id,
      supportsStrongs: false,
      verses: cached.verses,
      headings,
      copyright: cached.copyright || translation.attribution || null,
      attributionUrl: translation.attributionUrl || null,
    });
  }

  try {
    const { verses, copyright } = await fetchRemoteChapter(translation.id, book, chapter);
    await putCachedChapter(translation.id, book, chapter, verses, copyright);

    return withPublicCache({
      book,
      chapter,
      translation: translation.id,
      supportsStrongs: false,
      verses,
      headings,
      copyright: copyright || translation.attribution || null,
      attributionUrl: translation.attributionUrl || null,
    });
  } catch (err) {
    // The reader falls back to KJV on any of these, so the person still
    // gets to read -- just not in the translation they picked.
    const status = err.rateLimited ? 503 : 502;
    return NextResponse.json(
      {
        error: err.message || `Couldn't load that chapter in ${translation.label}.`,
        translation: translation.id,
        fallback: DEFAULT_TRANSLATION,
      },
      { status }
    );
  }
}
