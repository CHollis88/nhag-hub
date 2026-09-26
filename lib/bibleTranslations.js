// Registry of every Bible translation the app can display.
//
// Imported by BOTH client components (the translation picker) and
// server routes (the passage fetcher), so it must stay free of `fs`
// and of anything secret -- no API keys here, only the provider name.
// Keys live in env vars and are read server-side in lib/bibleProviders.js.
//
// `supportsStrongs` is the one the UI leans on hardest. Strong's
// numbers, the Matthew Henry commentary and the cross-reference set
// are all keyed to KJV word positions. A modern translation reorders
// and rewords the text, so those word-level features have nothing to
// attach to. Rather than show them pointing at the wrong words, the
// reader hides them wherever this is false.
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
    attribution: null, // public domain
  },
  {
    id: "esv",
    label: "ESV",
    fullName: "English Standard Version",
    provider: "crossway",
    supportsStrongs: false,
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
    attribution:
      "Holy Bible, New Living Translation, copyright \u00a9 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved.",
    attributionUrl: "https://www.tyndale.com",
  },
];

export const DEFAULT_TRANSLATION = "kjv";

export function getTranslation(id) {
  return TRANSLATIONS.find((t) => t.id === id) || null;
}

export function isValidTranslation(id) {
  return TRANSLATIONS.some((t) => t.id === id);
}
