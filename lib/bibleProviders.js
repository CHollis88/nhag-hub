import { ABBR_TO_NAME, parseProviderReference } from "@/lib/bibleRef";
import { getTranslation } from "@/lib/bibleTranslations";
import { fetchApiBibleChapter, searchApiBible } from "@/lib/apiBible";

// Server-only. Fetches a chapter from an external translation provider
// and normalizes it into the SAME shape the local KJV/BSB files use, so
// PassageReader renders every translation through one code path:
//
//   { "1": [{ t: "In", s: [] }, { t: "the", s: [] }, ...], "2": [...] }
//
// `s` (Strong's numbers) is always empty here -- only the local KJV/BSB
// data carries word-level Strong's. See bibleTranslations.js.
// `r: true` marks a word as Christ's words (red-letter), where the
// source actually tells us (API.Bible's "wj" spans). ESV's plain-text
// endpoint carries no such markup at all, so ESV tokens never get `r`.
//
// The two providers return completely different formats: Crossway
// sends verse-numbered plain text; API.Bible (NLT, NKJV, AMP -- see
// lib/apiBible.js) sends HTML. Each gets its own parser; they meet at
// the shape above, plus a `headings` map
// ({ verseNum: "heading text" }, for the verse the heading precedes)
// and a `footnotes` map ({ verseNum: ["note text", ...] }).

/** Turn a run of plain text into the token array the reader expects. */
// Books with only one chapter. Both publishers' reference parsers read
// "<Book> 1" for these as VERSE 1, not chapter 1 (the same way "Jude 5"
// means Jude verse 5) -- so asking for "Obadiah 1" returned a single
// verse. For these, request the bare book name, which both APIs treat
// as the whole book.
const SINGLE_CHAPTER_BOOKS = new Set(["Oba", "Phm", "2Jo", "3Jo", "Jde"]);

function tokenize(body, { red = false } = {}) {
  const clean = body.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.split(" ").map((w) => (red ? { t: w, s: [], r: true } : { t: w, s: [] }));
}

// ── Crossway (ESV) ───────────────────────────────────────────────────
// Returns `[1] In the beginning... [2] ...` as plain text, with
// headings (when requested) rendered as their own line, set off by
// blank lines, immediately before the `[N]` of the verse they precede.
//
// CAVEAT: this heading extraction is written from ESV's documented
// plain-text conventions, not a live captured response (unlike the NLT
// parsing below, which IS checked against real API output). It degrades
// safely -- if the pattern doesn't match, headings for that chapter
// come back empty, exactly like before this change, and verse text is
// never at risk because heading extraction runs and is stripped BEFORE
// the verse-number split. Worth a live check once deployed; if
// mismatched, ESV headings just won't populate anywhere -- no crash.
//
// Footnotes are deliberately NOT parsed here yet (include-footnotes
// stays false). ESV's plain-text footnote callouts are numbered
// markers in the body text, and the verse-splitter below keys off
// `[digit]` to find verse boundaries -- if a footnote callout also
// renders as `[N]`, turning footnotes on would misparse those as new
// verse boundaries and corrupt every chapter that has one. That's a
// real risk, not a hypothetical, and not one worth taking without a
// live response in hand to confirm the actual callout format first.

// The lookahead allows leading spaces before "[N]": poetry (Psalms,
// prophets) is indented, and requiring "[N]" at column 0 meant headings
// above any indented verse were silently never captured.
const ESV_HEADING_RE = /(?:^|\n[ \t]*\n)[ \t]*([A-Z][^\n[\]]{1,80}?)[ \t]*\n[ \t]*\n(?=[ \t]*\[(\d+)\])/g;

function extractEsvHeadings(text) {
  const headings = {};
  const cleaned = text.replace(ESV_HEADING_RE, (whole, headingText, verseNum) => {
    headings[verseNum] = headingText.trim();
    return "\n\n";
  });
  return { cleaned, headings };
}

function parseNumberedText(text) {
  const verses = {};
  if (!text) return verses;

  // Split on bracketed verse numbers, keeping the numbers. Anything
  // before verse 1 (chapter number, stray heading) is dropped.
  const parts = text.split(/\[(\d+)\]/);
  for (let i = 1; i < parts.length; i += 2) {
    const tokens = tokenize(parts[i + 1] || "");
    if (tokens) verses[parts[i]] = tokens;
  }
  return verses;
}

// Psalm superscriptions ("A Psalm of David.", "For the choir director:
// A psalm of the descendants of Korah.") are not section headings. They
// travel in the headings object under the reserved key "_sup:<verse>"
// (the same trick as "_pv" in lib/bibleCache.js -- no verse number can
// collide with it), and the reader draws them as a grey italic line
// above the verse, like KJV and BSB. No schema or API change needed.
const SUPERSCRIPTION_RE = new RegExp(
  [
    // bare title words: "A Psalm of David", "A Maskil of Asaph", "A Miktam"
    "^(?:(?:a|an)\\s+)?(?:psalm|maskil|miktam|michtam|shiggaion|davidic)\\b",
    // "song"/"prayer" are also common section-heading words ("A Prayer for
    // Help"), so only when followed by a name, "ascents", or nothing
    "^(?:a\\s+)?(?:song|prayer)(?:\\s+of\\s+(?:david|moses|asaph|solomon|heman|ethan|korah|ascents|degrees|the\\s+(?:sons|descendants))\\b|\\s+for\\s+the\\s+sabbath|\\s*[.:;]|\\s*$)",
    "^(?:for|to)\\s+the\\s+(?:choir|chief|director|leader|music|tune)",
    "^of\\s+(?:david|asaph|solomon|moses|heman|ethan|the\\s+(?:sons|descendants))\\b",
    "^according\\s+to\\b",
  ].join("|"),
  "i"
);

// Psalm 119's acrostic stanza letters, in the spellings ESV, NLT, BSB
// and KJV use ("Aleph"/"ALEPH.", "Vav"/"Waw"/"VAU.", "Tsadhe"/"TZADDI.").
const HEBREW_LETTER_RE =
  /^(?:aleph|alef|beth|bet|gimel|daleth|dalet|he|waw|vav|vau|zayin|zain|heth|het|cheth|teth|tet|yodh|yod|jod|kaph|kaf|caph|lamedh|lamed|mem|nun|samekh|samech|ayin|ain|pe|peh|tsadhe|tsade|tzaddi|sadhe|qoph|qof|koph|resh|sin|shin|schin|taw|tav|tau)\.?$/i;

function isHebrewLetter(text) {
  return HEBREW_LETTER_RE.test((text || "").trim());
}

function isSuperscription(text) {
  return SUPERSCRIPTION_RE.test((text || "").replace(/^[\u201c"'\s]+/, ""));
}

function setSuperscription(headings, verse, text) {
  const key = `_sup:${verse}`;
  headings[key] = headings[key] ? `${headings[key]} ${text}` : text;
}

// Text before the first [N] -- in Psalms, the superscription ("A Psalm
// of David...") and sometimes a section title -- used to be thrown
// away. Keep it as the first verse's heading instead. A bare chapter
// number or empty lead-in is ignored.
function leadingEsvLines(text) {
  const first = text.search(/\[\d+\]/);
  if (first <= 0) return [];
  const lines = text
    .slice(0, first)
    .split(/\n[ \t]*\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => /[A-Za-z]/.test(line) && line.length <= 300);
  return lines;
}

function leadingEsvText(text) {
  return leadingEsvLines(text).join(" \u2014 ");
}

async function fetchCrosswayEsv(bookAbbr, chapter) {
  const key = process.env.ESV_API_KEY;
  if (!key) throw new Error("ESV is not configured on this server (ESV_API_KEY is unset).");

  const url =
    "https://api.esv.org/v3/passage/text/?" +
    new URLSearchParams({
      q: SINGLE_CHAPTER_BOOKS.has(bookAbbr) ? ABBR_TO_NAME[bookAbbr] : `${ABBR_TO_NAME[bookAbbr]} ${chapter}`,
      "include-headings": "true",
      "include-subheadings": "true",
      "include-footnotes": "false",
      "include-verse-numbers": "true",
      "include-short-copyright": "false",
      "include-passage-references": "false",
      "indent-paragraphs": "0",
    });

  const res = await fetch(url, { headers: { Authorization: `Token ${key}` } });
  if (!res.ok) {
    if (res.status === 429) {
      const err = new Error("ESV is temporarily unavailable (daily API limit reached).");
      err.rateLimited = true;
      throw err;
    }
    throw new Error(`ESV request failed (${res.status}).`);
  }

  const data = await res.json();
  const { cleaned, headings } = extractEsvHeadings((data.passages || []).join("\n"));
  const verses = parseNumberedText(cleaned);
  const firstVerse = Object.keys(verses).sort((a, b) => a - b)[0];
  if (firstVerse) {
    // Everything above the first verse: lead-in lines, plus whatever the
    // heading pass attached to it. Psalm titles go to their own line;
    // real section headings stay headings.
    const parts = [...leadingEsvLines(cleaned), ...(headings[firstVerse] ? [headings[firstVerse]] : [])];
    const headingParts = [];
    for (const part of parts) {
      if (bookAbbr === "Psa" && isSuperscription(part)) setSuperscription(headings, firstVerse, part);
      else headingParts.push(part);
    }
    if (headingParts.length) headings[firstVerse] = headingParts.join(" \u2014 ");
    else delete headings[firstVerse];
  }
  // Psalm 119's stanza letters come through as ordinary headings; show
  // them as titles like the other translations.
  if (bookAbbr === "Psa") {
    for (const [v, text] of Object.entries(headings)) {
      if (!v.startsWith("_") && isHebrewLetter(text)) {
        setSuperscription(headings, v, text);
        delete headings[v];
      }
    }
  }
  if (Object.keys(verses).length === 0) throw new Error("ESV returned no text for that chapter.");
  return { verses, headings, footnotes: {} };
}

// Shared HTML entity decoding (used by the search text cleaner below).
function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;|&rsquo;/g, "\u2019")
    .replace(/&#8216;|&lsquo;/g, "\u2018")
    .replace(/&#8220;|&ldquo;/g, "\u201c")
    .replace(/&#8221;|&rdquo;/g, "\u201d")
    .replace(/&#8212;|&mdash;/g, "\u2014")
    .replace(/&#8211;|&ndash;/g, "\u2013")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&hellip;/g, "\u2026")
    .replace(/&(?:ensp|emsp|thinsp);/g, " ")
    // Any other numeric entity, decimal or hex (e.g. &#x2019;), so
    // nothing outside the list above can ever print raw in a verse.
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

/**
 * Fetch one chapter of a non-local translation.
 * Returns { verses, headings, footnotes }. Throws on misconfiguration
 * or provider error; quota errors carry `.rateLimited = true`.
 */
export async function fetchRemoteChapter(translationId, bookAbbr, chapter) {
  const translation = getTranslation(translationId);
  if (!translation) throw new Error("Unknown translation.");
  if (translation.provider === "local") {
    throw new Error("Local translations are not fetched through this module.");
  }
  if (!ABBR_TO_NAME[bookAbbr]) throw new Error("Unknown book.");

  if (translation.provider === "crossway") return fetchCrosswayEsv(bookAbbr, chapter);
  if (translation.provider === "apibible") return fetchApiBibleChapter(translation.id, bookAbbr, chapter);
  throw new Error("Unknown provider.");
}

// ---------------------------------------------------------------------------
// Search for the two translations that aren't stored in the app (ESV, NLT).
// Each publisher has its own search API; both are asked server-side so the
// API keys never reach the browser. Results come back in the same shape as
// the local KJV/BSB search: [{ book, chapter, verse, text }].
//
// Every search spends one request from the shared daily allowance, so
// identical searches are remembered for a few minutes per server instance.

const SEARCH_CACHE_MS = 10 * 60 * 1000;
const searchCache = new Map(); // "esv|query" -> { at, value }

function cleanText(html) {
  return decodeEntities(String(html).replace(/<[^>]+>/g, " "))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function readableError(message) {
  const err = new Error(message);
  err.readable = true;
  return err;
}

function quotaError(name) {
  const err = readableError(`${name} search has hit its daily limit. Try again tomorrow, or search in KJV or BSB.`);
  err.rateLimited = true;
  return err;
}

async function searchCrosswayEsv(query, limit) {
  const key = process.env.ESV_API_KEY;
  if (!key) throw readableError("ESV isn't set up on this server.");
  const url =
    "https://api.esv.org/v3/passage/search/?" +
    new URLSearchParams({ q: query, "page-size": String(Math.min(limit, 100)) });
  const res = await fetch(url, { headers: { Authorization: `Token ${key}` }, signal: AbortSignal.timeout(10000) });
  if (res.status === 429) throw quotaError("ESV");
  if (!res.ok) throw readableError(`ESV search didn't answer (${res.status}).`);
  const data = await res.json();
  const passages = [];
  for (const r of data.results || []) {
    const ref = parseProviderReference(r.reference);
    if (!ref) continue; // never show a result we can't open
    passages.push({ book: ref.book, chapter: ref.chapter, verse: ref.verse || 1, text: cleanText(r.content) });
  }
  return { passages, total: Number(data.total_results) || passages.length };
}

/** Search ESV, NLT, NKJV or AMP. Returns { passages, total }. Throws a readable error. */
export async function searchRemoteTranslation(translationId, query, { limit = 25 } = {}) {
  const translation = getTranslation(translationId);
  if (!translation || translation.provider === "local") throw readableError("Not a publisher translation.");
  const cacheKey = `${translationId}|${limit}|${query.toLowerCase().trim()}`;
  const hit = searchCache.get(cacheKey);
  if (hit && Date.now() - hit.at < SEARCH_CACHE_MS) return hit.value;

  let value;
  try {
    if (translation.provider === "crossway") value = await searchCrosswayEsv(query, limit);
    else if (translation.provider === "apibible") value = await searchApiBible(translationId, query, limit);
    else throw readableError("Unknown provider.");
  } catch (err) {
    if (err?.readable) throw err;
    console.error(`[bible search] ${translationId} network error:`, err?.message);
    throw readableError(`Couldn't reach the ${translation.label} search just now. Try again, or search another translation.`);
  }

  if (searchCache.size > 200) searchCache.delete(searchCache.keys().next().value);
  searchCache.set(cacheKey, { at: Date.now(), value });
  return value;
}
