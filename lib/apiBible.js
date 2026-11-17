import { supabaseServer } from "@/lib/supabaseServer";

// ── API.Bible (American Bible Society) ─────────────────────────────────
// NLT, NKJV and AMP come from API.Bible (Starter plan: 5,000 calls a
// month across all three, a visible "api.bible" credit link required).
// The key lives ONLY in the Vercel env var API_BIBLE_KEY and is sent
// server-side in the `api-key` header; it never reaches the browser.
//
// Calls are kept low on purpose:
//   - chapters are stored in bible_chapter_cache (lib/bibleCache.js) and
//     re-fetched at most every 28 days (API.Bible's terms: cached text
//     must be refreshed at least every 30 days);
//   - the Bible IDs are looked up once and saved in app_settings, so a
//     cold server start doesn't spend a call;
//   - repeated searches are remembered for 10 minutes per instance.
//
// FUMS (API.Bible's required usage tracking for web apps): every chapter
// and search answer carries a fumsToken. The server hands it to the
// browser, which reports it with one tiny image request straight to
// fums.api.bible (lib/fums.js) -- no Vercel or Supabase cost.

// API_BIBLE_BASE_URL exists only so tests can point the app at a stand-in.
export const API_BIBLE_BASE = process.env.API_BIBLE_BASE_URL || "https://rest.api.bible/v1";
export const API_BIBLE_CREDIT_URL = "https://api.bible";

// App book code -> USFM book ID that API.Bible uses ("JHN.3").
const USFM = {
  Gen: "GEN", Exo: "EXO", Lev: "LEV", Num: "NUM", Deu: "DEU", Jos: "JOS", Jdg: "JDG", Rth: "RUT",
  "1Sa": "1SA", "2Sa": "2SA", "1Ki": "1KI", "2Ki": "2KI", "1Ch": "1CH", "2Ch": "2CH", Ezr: "EZR",
  Neh: "NEH", Est: "EST", Job: "JOB", Psa: "PSA", Pro: "PRO", Ecc: "ECC", Sng: "SNG", Isa: "ISA",
  Jer: "JER", Lam: "LAM", Eze: "EZK", Dan: "DAN", Hos: "HOS", Joe: "JOL", Amo: "AMO", Oba: "OBA",
  Jon: "JON", Mic: "MIC", Nah: "NAM", Hab: "HAB", Zep: "ZEP", Hag: "HAG", Zec: "ZEC", Mal: "MAL",
  Mat: "MAT", Mar: "MRK", Luk: "LUK", Jhn: "JHN", Act: "ACT", Rom: "ROM", "1Co": "1CO", "2Co": "2CO",
  Gal: "GAL", Eph: "EPH", Phl: "PHP", Col: "COL", "1Th": "1TH", "2Th": "2TH", "1Ti": "1TI", "2Ti": "2TI",
  Tit: "TIT", Phm: "PHM", Heb: "HEB", Jas: "JAS", "1Pe": "1PE", "2Pe": "2PE", "1Jo": "1JN", "2Jo": "2JN",
  "3Jo": "3JN", Jde: "JUD", Rev: "REV",
};
const FROM_USFM = Object.fromEntries(Object.entries(USFM).map(([a, u]) => [u, a]));

export function toUsfm(bookAbbr) {
  return USFM[bookAbbr] || null;
}
export function fromUsfm(code) {
  return FROM_USFM[String(code || "").toUpperCase()] || null;
}

// How each app translation is recognised in the account's /bibles list.
// Matched on the abbreviation first, then the full name as a fallback.
const MATCH = {
  nlt: { abbr: ["NLT", "NLT15", "NLT2015"], name: /new living translation/i },
  nkjv: { abbr: ["NKJV"], name: /new king james/i },
  amp: { abbr: ["AMP", "AMPC"], name: /amplified/i, prefer: "AMP" },
};

export function apiBibleError(message, { rateLimited = false } = {}) {
  const err = new Error(message);
  err.readable = true;
  if (rateLimited) err.rateLimited = true;
  return err;
}

function key() {
  const k = process.env.API_BIBLE_KEY;
  if (!k) throw apiBibleError("This translation isn't set up on the server yet (API_BIBLE_KEY is missing).");
  return k;
}

export async function apiBibleGet(path, params = {}) {
  const url = `${API_BIBLE_BASE}${path}` + (Object.keys(params).length ? "?" + new URLSearchParams(params) : "");
  const res = await fetch(url, {
    headers: { "api-key": key(), accept: "application/json" },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (res.status === 429) {
    throw apiBibleError("This translation has hit its monthly reading limit. KJV and BSB still work.", { rateLimited: true });
  }
  if (res.status === 401) throw apiBibleError("The Bible service didn't accept the app's key.");
  if (res.status === 403) throw apiBibleError("The app isn't licensed for this translation on API.Bible.");
  if (res.status === 404) {
    const err = apiBibleError("That passage wasn't found in this translation.");
    err.notFound = true;
    throw err;
  }
  if (!res.ok) throw apiBibleError(`The Bible service didn't answer (${res.status}).`);
  return res.json();
}

// ── Bible IDs ─────────────────────────────────────────────────────────
// Order: env override (API_BIBLE_ID_NLT etc.) -> this instance's memory
// -> app_settings row "apibible_ids" -> one /bibles call, then saved.
let idMemo = null; // { nlt: "...", nkjv: "...", amp: "..." }
const ID_SETTING = "apibible_ids";

export function pickBibleIds(list) {
  const ids = {};
  const english = (list || []).filter((b) => !b.language?.id || b.language.id === "eng");
  for (const [tid, m] of Object.entries(MATCH)) {
    const ab = (b) => [b.abbreviation, b.abbreviationLocal].map((x) => String(x || "").toUpperCase());
    let hit =
      (m.prefer && english.find((b) => ab(b).includes(m.prefer))) ||
      english.find((b) => ab(b).some((a) => m.abbr.includes(a))) ||
      english.find((b) => m.name.test(b.name || "") || m.name.test(b.nameLocal || ""));
    if (hit) ids[tid] = hit.id;
  }
  return ids;
}

export async function bibleIdFor(translationId) {
  const env = process.env[`API_BIBLE_ID_${translationId.toUpperCase()}`];
  if (env) return env;
  if (idMemo?.[translationId]) return idMemo[translationId];

  const supabase = supabaseServer();
  try {
    const { data } = await supabase.from("app_settings").select("value").eq("key", ID_SETTING).maybeSingle();
    if (data?.value && typeof data.value === "object") {
      idMemo = { ...(idMemo || {}), ...data.value };
      if (idMemo[translationId]) return idMemo[translationId];
    }
  } catch {
    // table missing (migration not run yet) -- fall through to the API
  }

  const json = await apiBibleGet("/bibles");
  const ids = pickBibleIds(json?.data);
  idMemo = { ...(idMemo || {}), ...ids };
  if (Object.keys(ids).length) {
    supabase
      .from("app_settings")
      .upsert({ key: ID_SETTING, value: idMemo, updated_at: new Date().toISOString() }, { onConflict: "key" })
      .then(() => {}, () => {});
  }
  if (!idMemo[translationId]) {
    throw apiBibleError("This translation isn't available on the church's API.Bible account.");
  }
  return idMemo[translationId];
}

/** Forget a saved Bible ID (e.g. it started answering 404/403). */
export async function forgetBibleId(translationId) {
  if (idMemo) delete idMemo[translationId];
  try {
    const supabase = supabaseServer();
    const { data } = await supabase.from("app_settings").select("value").eq("key", ID_SETTING).maybeSingle();
    if (data?.value?.[translationId]) {
      const value = { ...data.value };
      delete value[translationId];
      await supabase.from("app_settings").upsert({ key: ID_SETTING, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    }
  } catch {
    // ignore
  }
}

// ── Chapter HTML -> the app's token shape ───────────────────────────────
// API.Bible's html content (include-titles, verse numbers on, notes off):
//   <p class="s1">The Creation</p>
//   <p class="p"><span data-number="1" data-sid="GEN 1:1" class="v">1</span>In the
//   beginning God created the heavens and the earth. <span ... class="v">2</span>...</p>
// Words of Jesus: <span class="wj">. Divine name: <span class="nd">Lord</span>
// (small caps in print; written "LORD" here, the way the KJV data has it).

const HEADING_CLASSES = /^(?:s\d?|ms\d?|mr|sr|sp|cl|qa|d|mt\d?|imt\d?|is\d?|r)$/;

function decode(s) {
  return String(s)
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘")
    .replace(/&rdquo;/g, "”").replace(/&ldquo;/g, "“")
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&hellip;/g, "…")
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

const PUNCT_ONLY = /^[.,;:!?’”"')\]—…]+$/;

/** Append text to a verse's tokens. Punctuation that the markup split off
 * a word ("LORD" + ",") rejoins the word before it, so word positions --
 * and the highlights saved against them -- don't depend on markup. */
function pushWords(tokens, text, red, glue) {
  const words = text.split(/\s+/).filter(Boolean);
  words.forEach((w, i) => {
    const prev = tokens[tokens.length - 1];
    if (prev && ((i === 0 && glue) || PUNCT_ONLY.test(w))) {
      prev.t += w;
      if (red && !prev.r) prev.r = true;
    } else {
      tokens.push(red ? { t: w, s: [], r: true } : { t: w, s: [] });
    }
  });
}

export function parseApiBibleHtml(html) {
  const verses = {};
  const headings = {};
  const pendingHeads = [];
  const pendingSups = [];

  let verse = null; // current verse key
  let block = null; // class of the current <p>
  let headText = "";
  const spanStack = []; // classes of open spans
  let skipDepth = 0; // inside the verse-number span (or a note)
  let lastEndedWithSpace = true;

  const isRed = () => spanStack.includes("wj");
  const isNd = () => spanStack.includes("nd");

  const flushHeading = () => {
    const text = decode(headText).replace(/\s+/g, " ").trim();
    headText = "";
    if (!text || block === "r" || block === "cl" || /^mt|^imt|^is/.test(block || "")) return; // parallel refs / titles
    // "d" = a psalm's title ("A psalm of David."), "qa" = Psalm 119's
    // stanza letters: both drawn as the grey italic line above the verse.
    if (block === "d" || block === "qa") pendingSups.push(text);
    else pendingHeads.push(text);
  };

  const startVerse = (num) => {
    verse = num;
    if (pendingHeads.length) {
      headings[num] = headings[num] ? `${headings[num]} ${pendingHeads.join(" ")}` : pendingHeads.join(" ");
      pendingHeads.length = 0;
    }
    if (pendingSups.length) {
      const k = `_sup:${num}`;
      headings[k] = headings[k] ? `${headings[k]} ${pendingSups.join(" ")}` : pendingSups.join(" ");
      pendingSups.length = 0;
    }
    lastEndedWithSpace = true;
  };

  const re = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html || "")) !== null) {
    const [, closing, tagRaw, attrs, text] = m;
    if (text != null) {
      if (skipDepth > 0) continue;
      if (block && HEADING_CLASSES.test(block)) {
        headText += text;
        continue;
      }
      if (!verse) continue; // stray text before verse 1
      let t = decode(text);
      if (isNd()) t = t.toUpperCase();
      if (!t.trim()) {
        if (t.length) lastEndedWithSpace = true;
        continue;
      }
      const glue = !lastEndedWithSpace && !/^\s/.test(t);
      verses[verse] ??= [];
      pushWords(verses[verse], t, isRed(), glue);
      lastEndedWithSpace = /\s$/.test(t);
      continue;
    }
    const tag = tagRaw.toLowerCase();
    const cls = (attrs.match(/class="([^"]*)"/) || [])[1] || "";
    if (tag === "p" || tag === "div") {
      if (closing) {
        if (block && HEADING_CLASSES.test(block)) flushHeading();
        block = null;
        lastEndedWithSpace = true;
      } else {
        block = cls.split(/\s+/)[0] || "p";
        headText = "";
        lastEndedWithSpace = true;
      }
      continue;
    }
    if (tag === "br") {
      lastEndedWithSpace = true;
      continue;
    }
    if (tag === "span" || tag === "sup") {
      if (closing) {
        spanStack.pop();
        if (skipDepth > 0) skipDepth--;
        continue;
      }
      if (/\/\s*$/.test(attrs)) continue; // self-closing
      const first = cls.split(/\s+/)[0];
      if (skipDepth > 0) {
        spanStack.push(first);
        skipDepth++;
        continue;
      }
      if (first === "v") {
        const num = (attrs.match(/data-number="([^"]+)"/) || [])[1];
        const key = num ? String(parseInt(num, 10)) : null;
        if (key && key !== "NaN") startVerse(key);
        spanStack.push(first);
        skipDepth = 1;
        continue;
      }
      if (first === "f" || first === "x" || first === "fn" || first === "c" || first === "cl") {
        spanStack.push(first);
        skipDepth = 1;
        continue;
      }
      spanStack.push(first);
    }
  }
  return { verses, headings };
}

/** Fetch one chapter. Returns { verses, headings, footnotes, copyright, fumsToken }. */
export async function fetchApiBibleChapter(translationId, bookAbbr, chapter) {
  const usfm = toUsfm(bookAbbr);
  if (!usfm) throw apiBibleError("Unknown book.");
  const params = {
    "content-type": "html",
    "include-notes": "false",
    "include-titles": "true",
    "include-chapter-numbers": "false",
    "include-verse-numbers": "true",
    "include-verse-spans": "false",
    "fums-version": "3",
  };
  let json;
  for (let attempt = 0; ; attempt++) {
    const id = await bibleIdFor(translationId);
    try {
      json = await apiBibleGet(`/bibles/${id}/chapters/${usfm}.${Number(chapter)}`, params);
      break;
    } catch (err) {
      // A saved ID that stopped working (plan changed): look it up again once.
      if (attempt === 0 && !process.env[`API_BIBLE_ID_${translationId.toUpperCase()}`] && /licensed/.test(err.message)) {
        await forgetBibleId(translationId);
        continue;
      }
      throw err;
    }
  }
  const data = json?.data || {};
  const { verses, headings } = parseApiBibleHtml(data.content || "");
  if (Object.keys(verses).length === 0) throw apiBibleError("The Bible service returned no text for that chapter.");
  return {
    verses,
    headings,
    footnotes: {},
    copyright: cleanCopyright(data.copyright),
    fumsToken: json?.meta?.fumsToken || null,
  };
}

function cleanCopyright(c) {
  if (!c) return null;
  return decode(String(c).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() || null;
}

/** Search. Returns { passages: [{book, chapter, verse, text}], total, fumsToken }. */
export async function searchApiBible(translationId, query, limit) {
  const id = await bibleIdFor(translationId);
  const json = await apiBibleGet(`/bibles/${id}/search`, {
    query,
    limit: String(Math.min(limit, 100)),
    sort: "relevance",
    "fums-version": "3",
  });
  const data = json?.data || {};
  const passages = [];
  for (const v of data.verses || []) {
    // "JHN.3.16" -- open exactly the verse the search found.
    const [b, c, vs] = String(v.id || "").split(".");
    const book = fromUsfm(b);
    const ch = parseInt(c, 10);
    const verse = parseInt(vs, 10);
    if (!book || !ch) continue;
    const text = decode(String(v.text || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (!text) continue;
    passages.push({ book, chapter: ch, verse: verse || 1, text });
  }
  // A search typed as a reference ("John 3:16") comes back in `passages`.
  for (const p of data.passages || []) {
    if (passages.length >= limit) break;
    const [b, c, vs] = String(p.id || "").split(/[.-]/);
    const book = fromUsfm(b);
    const ch = parseInt(c, 10);
    if (!book || !ch) continue;
    const text = decode(String(p.content || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 400);
    passages.push({ book, chapter: ch, verse: parseInt(vs, 10) || 1, text });
  }
  return {
    passages: passages.slice(0, limit),
    total: Number(data.total) || passages.length,
    fumsToken: json?.meta?.fumsToken || null,
  };
}
