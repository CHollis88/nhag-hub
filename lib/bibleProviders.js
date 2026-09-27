import { ABBR_TO_NAME } from "@/lib/bibleRef";
import { getTranslation } from "@/lib/bibleTranslations";

// Server-only. Fetches a chapter from an external translation provider
// and normalizes it into the SAME shape the local KJV/BSB files use, so
// PassageReader renders every translation through one code path:
//
//   { "1": [{ t: "In", s: [] }, { t: "the", s: [] }, ...], "2": [...] }
//
// `s` (Strong's numbers) is always empty here -- only the local KJV/BSB
// data carries word-level Strong's. See bibleTranslations.js.
// `r: true` marks a word as Christ's words (red-letter), where the
// source actually tells us -- see NLT below. ESV's plain-text endpoint
// carries no such markup at all, so ESV tokens never get `r`.
//
// The two providers return completely different formats: Crossway
// sends verse-numbered plain text, Tyndale sends HTML. Each gets its
// own parser; they meet at the shape above, plus a `headings` map
// ({ verseNum: "heading text" }, for the verse the heading precedes)
// and a `footnotes` map ({ verseNum: ["note text", ...] }).

/** Turn a run of plain text into the token array the reader expects. */
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

const ESV_HEADING_RE = /(?:^|\n[ \t]*\n)[ \t]*([A-Z][^\n[\]]{1,80}?)[ \t]*\n[ \t]*\n(?=\[(\d+)\])/g;

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

async function fetchCrosswayEsv(bookAbbr, chapter) {
  const key = process.env.ESV_API_KEY;
  if (!key) throw new Error("ESV is not configured on this server (ESV_API_KEY is unset).");

  const url =
    "https://api.esv.org/v3/passage/text/?" +
    new URLSearchParams({
      q: `${ABBR_TO_NAME[bookAbbr]} ${chapter}`,
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
  if (Object.keys(verses).length === 0) throw new Error("ESV returned no text for that chapter.");
  return { verses, headings, footnotes: {} };
}

// ── Tyndale (NLT) ────────────────────────────────────────────────────
// Returns an HTML document, not JSON. Each verse arrives as:
//
//   <verse_export orig="john_3_16" bk="john" ch="3" vn="16">
//     <p class="body"><span class="vn">16</span>
//       <span class="red">"For this is how God loved the world: He gave
//         <a class="a-tn">*</a><span class="tn">
//           <span class="tn-ref">3:16</span> Or <em>...</em>
//         </span>
//       his one and only Son ...</span>
//     </p>
//   </verse_export>
//
// (This exact shape is a real captured API response, not inferred.)
// A section heading, when present, shows up as an <h3 class="subhead">
// INSIDE the verse_export of the verse it precedes; the chapter's own
// <h2 class="bk_ch_vs_header"> ("John 3, NLT") shows up the same way on
// verse 1 and is NOT a section heading -- must be discarded, not
// captured.
//
// Extraction order matters and must happen in THIS order:
//   1. Capture <h3 class="subhead"> content as this verse's heading,
//      then remove ALL headings (h1-h6, including the h2 chapter title)
//      -- removing without capturing first would splice heading text
//      onto the front of the verse (the original heading-bleed bug).
//   2. Capture <span class="tn"> content as a footnote, THEN remove it
//      (plus its <a class="a-tn"> marker) -- same reason.
//   3. Split on <span class="red">...</span> boundaries so red-letter
//      words can be tagged, tokenizing each stretch separately.
//   4. Strip the inline <span class="vn"> verse number and any
//      remaining tags.

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
 * Remove every <span class="<cls>">…</span> including its nested spans,
 * optionally handing each match's inner content to `onMatch` first.
 *
 * A plain lazy regex is WRONG here and fails silently in a way that's
 * easy to miss: Tyndale's footnote spans contain their own nested
 * spans (<span class="tn"><span class="tn-ref">3:16</span> Or …</span>),
 * so `[\s\S]*?</span>` stops at the inner closing tag and leaves the
 * footnote's prose behind, mid-verse, reading as scripture. This walks
 * span depth to find the real matching close.
 */
function stripSpanClass(html, cls, onMatch) {
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
    if (end === -1) {
      if (onMatch) onMatch(html.slice(open.index + open[0].length));
      return html.slice(0, open.index);
    }
    if (onMatch) {
      const inner = html.slice(open.index + open[0].length, html.lastIndexOf("<", end));
      onMatch(inner);
    }
    html = html.slice(0, open.index) + html.slice(end);
  }
}

/** Split body on <span class="red">...</span> boundaries (depth-aware,
 * same reasoning as stripSpanClass), returning [{ text, red }, ...] in
 * document order so each stretch can be tokenized with the right flag. */
function splitByRedSpans(html) {
  const openRe = /<span class="red"[^>]*>/;
  const tagRe = /<(\/?)span\b[^>]*>/g;
  const segments = [];
  let cursor = 0;

  for (;;) {
    openRe.lastIndex = 0;
    const rest = html.slice(cursor);
    const open = openRe.exec(rest);
    if (!open) {
      segments.push({ text: html.slice(cursor), red: false });
      break;
    }
    const openStart = cursor + open.index;
    if (openStart > cursor) segments.push({ text: html.slice(cursor, openStart), red: false });

    let depth = 1;
    tagRe.lastIndex = openStart + open[0].length;
    let end = -1;
    for (let t = tagRe.exec(html); t; t = tagRe.exec(html)) {
      depth += t[1] ? -1 : 1;
      if (depth === 0) {
        end = t.index + t[0].length;
        break;
      }
    }
    const innerStart = openStart + open[0].length;
    if (end === -1) {
      segments.push({ text: html.slice(innerStart), red: true });
      break;
    }
    const innerEnd = html.lastIndexOf("<", end);
    segments.push({ text: html.slice(innerStart, innerEnd), red: true });
    cursor = end;
  }
  return segments;
}

function extractHtmlText(fragments) {
  return fragments
    .map((n) => (typeof n === "string" ? n : ""))
    .join(" ");
}

function parseTyndaleHtml(html) {
  const verses = {};
  const headings = {};
  const footnotes = {};
  if (!html) return { verses, headings, footnotes };

  const blockRe = /<verse_export\b[^>]*\bvn="(\d+)"[^>]*>([\s\S]*?)<\/verse_export>/g;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const num = m[1];
    let body = m[2];

    // 1. Headings -- capture <h3 class="subhead"> text as this verse's
    //    heading, then remove ALL h1-h6 (this also removes the h2
    //    chapter title, which is intentionally NOT captured as a
    //    heading -- it's just "John 3, NLT" restated).
    body = body.replace(/<h3\s+class="subhead"[^>]*>([\s\S]*?)<\/h3>/gi, (whole, inner) => {
      const text = decodeEntities(inner.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
      if (text) headings[num] = text;
      return "";
    });
    body = body.replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, "");
    body = stripSpanClass(body, "bk_ch_vs");

    // 2. Footnotes -- capture <span class="tn"> text before removing it.
    body = stripSpanClass(body, "tn", (inner) => {
      const text = decodeEntities(inner.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
      if (text) {
        footnotes[num] ??= [];
        footnotes[num].push(text);
      }
    });
    body = body.replace(/<a class="a-tn"[^>]*>[\s\S]*?<\/a>/g, "");

    // 3. Red-letter -- split on <span class="red"> before the verse
    //    number and remaining tags are stripped, so each stretch of
    //    Christ's words can be tokenized with r: true.
    const segments = splitByRedSpans(body);

    // 4. Verse number + remaining structural tags, per segment.
    let tokens = [];
    for (const seg of segments) {
      let text = stripSpanClass(seg.text, "vn");
      text = text.replace(/<[^>]+>/g, " ");
      const segTokens = tokenize(decodeEntities(text), { red: seg.red });
      if (segTokens) tokens = tokens.concat(segTokens);
    }

    if (tokens.length) {
      // A verse split across paragraphs yields two blocks with the same
      // vn; join rather than letting the second overwrite the first.
      verses[num] = verses[num] ? verses[num].concat(tokens) : tokens;
    }
  }
  return { verses, headings, footnotes };
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

  const { verses, headings, footnotes } = parseTyndaleHtml(await res.text());
  if (Object.keys(verses).length === 0) throw new Error("NLT returned no text for that chapter.");
  return { verses, headings, footnotes };
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
  if (translation.provider === "tyndale") return fetchTyndaleNlt(bookAbbr, chapter);
  throw new Error("Unknown provider.");
}
