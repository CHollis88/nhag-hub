import { NextResponse } from "next/server";
import { isValidBook, getLocalChapter, getLocalHeadings, getLocalFootnotes, getPericopes } from "@/lib/bible";
import { withPublicCache } from "@/lib/cacheHeaders";
import { getTranslation, DEFAULT_TRANSLATION } from "@/lib/bibleTranslations";
import { fetchRemoteChapter } from "@/lib/bibleProviders";
import { getCachedChapter, putCachedChapter } from "@/lib/bibleCache";

// Serves one chapter in one translation.
//
// kjv and bsb come off local disk (instant, no quota, both carry
// Strong's -- see lib/bibleTranslations.js supportsStrongs).
// esv and nlt go: Supabase cache -> provider API -> Supabase cache.
// See lib/bibleCache.js for why that cache is bounded (and why ESV
// isn't in it at all).
//
// Headings are NOT one shared thing across translations. Each
// translation's OWN section headings are used -- kjv's come from the
// separate pericopes.json outline (that's specifically a KJV artifact),
// bsb's are baked into its own local file (captured straight from its
// source data by scripts/tokenize-bsb.mjs), and esv/nlt's come back
// from their provider fetch. Showing KJV's headings on an ESV or NLT
// passage was a real bug -- the sections don't always fall in the same
// place -- so don't reintroduce that by defaulting to getPericopes for
// everything again.
//
// Footnotes follow the same per-translation shape: an object keyed by
// verse number, each value an array of footnote strings. kjv has none
// yet (no source data captured for it -- see the KJV build list item).

// ESV/NLT text comes from a parser that can change between deploys, so
// browsers only reuse it briefly (local KJV/BSB keep the long default).
const REMOTE_CACHE = { maxAge: 600, staleWhileRevalidate: 600 };

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

  if (translation.provider === "local") {
    const verses = getLocalChapter(translation.id, book, chapter);
    if (!verses) return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
    // Headings still come from the separate pericopes.json outline for
    // KJV specifically (that file IS the KJV's own outline) -- but
    // footnotes now come from KJV's own file too, same as any other
    // local translation, now that it has them (see
    // scripts/overlay-kjv-redletter-footnotes.mjs).
    const headings = translation.id === "kjv" ? getPericopes(book, chapter) : getLocalHeadings(translation.id, book, chapter);
    const footnotes = getLocalFootnotes(translation.id, book, chapter);
    return withPublicCache({
      book,
      chapter,
      translation: translation.id,
      supportsStrongs: true,
      verses,
      headings,
      footnotes,
      copyright: translation.attribution || null,
      attributionUrl: translation.attributionUrl || null,
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
      headings: cached.headings || {},
      footnotes: cached.footnotes || {},
      copyright: cached.copyright || translation.attribution || null,
      attributionUrl: translation.attributionUrl || null,
    }, REMOTE_CACHE);
  }

  try {
    const { verses, headings, footnotes, copyright } = await fetchRemoteChapter(translation.id, book, chapter);
    await putCachedChapter(translation.id, book, chapter, verses, copyright, headings, footnotes);

    return withPublicCache({
      book,
      chapter,
      translation: translation.id,
      supportsStrongs: false,
      verses,
      headings: headings || {},
      footnotes: footnotes || {},
      copyright: copyright || translation.attribution || null,
      attributionUrl: translation.attributionUrl || null,
    }, REMOTE_CACHE);
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
