import { ABBR_TO_NAME } from "@/lib/bibleRef";
import { getTranslation } from "@/lib/bibleTranslations";

// Server-only. Fetches a chapter from an external translation provider
// and normalizes it into the SAME shape the local KJV files use, so
// PassageReader renders every translation through one code path:
//
//   { "1": [{ t: "In", s: [] }, { t: "the", s: [] }, ...], "2": [...] }
//
// `s` (Strong's numbers) is always empty here -- only the local KJV
// data carries word-level Strong's. See bibleTranslations.js.
//
// The two providers return completely different formats: Crossway
// sends verse-numbered plain text, Tyndale sends HTML. Each gets its
// own parser; they meet at the shape above.

/** Turn a run of plain text into the token array the reader expects. */
function tokenize(body) {
  const clean = body.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.split(" ").map((w) => ({ t: w, s: [] }));
}

// ── Crossway (ESV) ───────────────────────────────────────────────────
// Returns `[1] In the beginning... [2] ...` as plain text.

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

async function fetchCrosswayEsv(bookAbbr, chapter) {
  const key = process.env.ESV_API_KEY;
  if (!key) throw new Error("ESV is not configured on this server (ESV_API_KEY is unset).");

  const url =
    "https://api.esv.org/v3/passage/text/?" +
    new URLSearchParams({
      q: `${ABBR_TO_NAME[bookAbbr]} ${chapter}`,
      "include-headings": "false",
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
  const verses = parseNumberedText((data.passages || []).join("\n"));
  if (Object.keys(verses).length === 0) throw new Error("ESV returned no text for that chapter.");
  return { verses };
}

// ── Tyndale (NLT) ────────────────────────────────────────────────────
// Returns an HTML document, not JSON. Each verse arrives as:
//
//   <verse_export orig="john_3_16" bk="john" ch="3" vn="16">
//     <p class="body"><span class="vn">16</span>text…</p>
//   </verse_export>
//
// Two things must be stripped before the text is usable, in this order:
//   1. <span class="tn">…</span> -- translator footnotes. Their text is
//      commentary, NOT scripture, and would otherwise land mid-verse.
//      Also <a class="a-tn">*</a>, the marker that points at them.
//   2. <span class="vn">16</span> -- the verse number, which we already
//      have from the vn attribute and don't want inside the words.
// Only then is it safe to strip remaining tags.

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
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/**
 * Remove every <span class="<cls>">…</span> including its nested spans.
 *
 * A plain lazy regex is WRONG here and fails silently in a way that's
 * easy to miss: Tyndale's footnote spans contain their own nested
 * spans (<span class="tn"><span class="tn-ref">3:16</span> Or …</span>),
 * so `[\s\S]*?</span>` stops at the inner closing tag and leaves the
 * footnote's prose behind, mid-verse, reading as scripture. This walks
 * span depth to find the real matching close.
 */
function stripSpanClass(html, cls) {
  const openRe = new RegExp(`<span class="${cls}"[^>]*>`);
  const tagRe = /<(\/?)span\b[^>]*>/g;

  for (;;) {
    const open = openRe.exec(html);
    if (!open) return html;

    let depth = 1;
    tagRe.lastIndex = open.index + open[0].length;
    let end = -1;
    for (let t = tagRe.exec(html); t; t = tagRe.exec(html)) {
      depth += t[1] ? -1 : 1;
      if (depth === 0) {
        end = t.index + t[0].length;
        break;
      }
    }
    // Unclosed span: drop the remainder rather than keep footnote text.
    if (end === -1) return html.slice(0, open.index);
    html = html.slice(0, open.index) + html.slice(end);
  }
}

function parseTyndaleHtml(html) {
  const verses = {};
  if (!html) return verses;

  const blockRe = /<verse_export\b[^>]*\bvn="(\d+)"[^>]*>([\s\S]*?)<\/verse_export>/g;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const num = m[1];
    let body = m[2];

    // 1. Footnotes and their markers -- commentary, not scripture.
    body = stripSpanClass(body, "tn");
    body = body.replace(/<a class="a-tn"[^>]*>[\s\S]*?<\/a>/g, "");
    // 2. The inline verse number -- we already have it from the attribute.
    body = stripSpanClass(body, "vn");
    // 3. Everything else structural.
    body = body.replace(/<[^>]+>/g, " ");

    const tokens = tokenize(decodeEntities(body));
    if (tokens) {
      // A verse split across paragraphs yields two blocks with the same
      // vn; join rather than letting the second overwrite the first.
      verses[num] = verses[num] ? verses[num].concat(tokens) : tokens;
    }
  }
  return verses;
}

async function fetchTyndaleNlt(bookAbbr, chapter) {
  const key = process.env.NLT_API_KEY;
  if (!key) throw new Error("NLT is not configured on this server (NLT_API_KEY is unset).");

  // Tyndale's reference parser wants no space in multi-word book names
  // ("1Corinthians.1", not "1 Corinthians.1").
  const ref = `${ABBR_TO_NAME[bookAbbr].replace(/\s+/g, "")}.${chapter}`;
  const url =
    "https://api.nlt.to/api/passages?" +
    new URLSearchParams({ ref, version: "NLT", key });

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429) {
      const err = new Error("NLT is temporarily unavailable (daily API limit reached).");
      err.rateLimited = true;
      throw err;
    }
    throw new Error(`NLT request failed (${res.status}).`);
  }

  const verses = parseTyndaleHtml(await res.text());
  if (Object.keys(verses).length === 0) throw new Error("NLT returned no text for that chapter.");
  return { verses };
}

/**
 * Fetch one chapter of a non-local translation.
 * Returns { verses }. Throws on misconfiguration or provider error;
 * quota errors carry `.rateLimited = true`.
 */
export async function fetchRemoteChapter(translationId, bookAbbr, chapter) {
  const translation = getTranslation(translationId);
  if (!translation) throw new Error("Unknown translation.");
  if (translation.provider === "local") {
    throw new Error("Local translations are not fetched through this module.");
  }
  if (!ABBR_TO_NAME[bookAbbr]) throw new Error("Unknown book.");

  if (translation.provider === "crossway") return fetchCrosswayEsv(bookAbbr, chapter);
  if (translation.provider === "tyndale") return fetchTyndaleNlt(bookAbbr, chapter);
  throw new Error("Unknown provider.");
}
