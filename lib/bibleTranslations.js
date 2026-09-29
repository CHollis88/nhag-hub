// Registry of every Bible translation the app can display.
//
// Imported by BOTH client components (the translation picker) and
// server routes (the passage fetcher), so it must stay free of `fs`
// and of anything secret -- no API keys here, only the provider name.
// Keys live in env vars and are read server-side in lib/bibleProviders.js.
//
// `supportsStrongs` gates word-level tapping: does THIS translation's
// own local data carry a Strong's number per word? True for kjv and
// bsb -- both are stored locally with {t, s} tokens. False for esv/nlt,
// which arrive as plain text from their publisher's API with no
// word-level alignment at all; the reader offers verse-level Strong's
// (sourced from KJV) for those instead -- see showVerseStrongs in
// PassageReader.
//
// `supportsCommentary` gates Matthew Henry and the commentary layouts.
// True everywhere by deliberate choice -- Matthew Henry quotes KJV
// phrasing directly, so his wording won't always match what's on
// screen in another translation, but that's an accepted tradeoff
// rather than a hidden mismatch. Cross-references (verse-keyed, not
// word-keyed) were already available on every translation regardless
// of this flag.
//
// `attribution` is a licensing obligation, not a nicety. Crossway
// requires the ESV notice and a link to esv.org on every page that
// displays their text. API.Bible returns each licensed Bible's own
// copyright string per request, so those carry `null` here and the
// route passes through whatever the API gives back -- don't render a
// passage without showing it.

export const TRANSLATIONS = [
  {
    id: "kjv",
    label: "KJV",
    fullName: "King James Version",
    provider: "local",
    supportsStrongs: true,
    supportsCommentary: true,
    attribution: null, // public domain
  },
  {
    id: "bsb",
    label: "BSB",
    fullName: "Berean Standard Bible",
    provider: "local",
    supportsStrongs: true,
    supportsCommentary: true,
    // Public domain (BSB-publishing/bsb2usfm, UNLICENSE) -- no
    // attribution required, but naming the source is good practice.
    attribution: "The Holy Bible, Berean Standard Bible (BSB) is produced in cooperation with Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible Translation Committee. This text of Scripture is in the Public Domain.",
    attributionUrl: "https://berean.bible",
  },
  {
    id: "esv",
    label: "ESV",
    fullName: "English Standard Version",
    provider: "crossway",
    supportsStrongs: false,
    supportsCommentary: true,
    attribution:
      "Scripture quotations are from the ESV\u00ae Bible (The Holy Bible, English Standard Version\u00ae), \u00a9 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.",
    attributionUrl: "https://www.esv.org",
  },
  {
    id: "nlt",
    label: "NLT",
    fullName: "New Living Translation",
    provider: "tyndale",
    supportsStrongs: false,
    supportsCommentary: true,
    attribution:
      "Holy Bible, New Living Translation, copyright \u00a9 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved.",
    attributionUrl: "https://www.tyndale.com",
  },
];

export const DEFAULT_TRANSLATION = "kjv";

// Bump whenever lib/bibleProviders.js changes how ESV/NLT text is
// parsed. Two things key off it so a parser fix takes effect everywhere
// with no manual cache clearing:
//   * the browser: lib/api.js adds it to the passage URL, so copies the
//     browser cached under the old parser are never reused;
//   * the database: lib/bibleCache.js ignores rows written by an older
//     parser and re-fetches them.
export const PASSAGE_FORMAT_VERSION = 6;

// v71 #7 -- the one-line description shown under each translation in the
// picker, generated from the capability flags above so it can never drift
// out of sync with what the reader actually does (it used to say "Reading
// only" for ESV/NLT, which also have commentary and cross-references).
// Cross-references work on every translation.
export function translationCapabilityText(t) {
  if (!t) return "";
  if (t.supportsStrongs) {
    return t.supportsCommentary
      ? "Word study, commentary, cross-references."
      : "Word study, cross-references.";
  }
  return t.supportsCommentary
    ? "Commentary, cross-references; tap a verse number for word meanings via the KJV."
    : "Cross-references; tap a verse number for word meanings via the KJV.";
}

export function getTranslation(id) {
  return TRANSLATIONS.find((t) => t.id === id) || null;
}

export function isValidTranslation(id) {
  return TRANSLATIONS.some((t) => t.id === id);
}
