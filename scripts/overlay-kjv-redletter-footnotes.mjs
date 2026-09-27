// One-time overlay script: eng-kjv2006 USFM -> red-letter + footnotes
// added ONTO the EXISTING data/bible/kjv/<Abbr>.json files.
//
// This does NOT replace the existing KJV text. The existing dataset is
// what the live app has always used (search, pericopes, Matthew Henry
// and cross-references are all keyed against it), and it matches this
// USFM source almost word-for-word (same translation, same Strong's
// tagging convention -- spot-checked identical on Ruth 1:1 down to the
// individual Strong's numbers). Replacing it wholesale would risk
// subtle formatting drift (e.g. this source hyphenates "Beth-lehem-
// judah"; the existing data doesn't) rippling into search and existing
// verse-keyed data for no real benefit. Overlaying is the safer move:
// existing text is untouched, we only ADD what it was missing.
//
// Footnotes need no alignment -- they're rendered per-verse (same as
// NLT/BSB already are), so the verse number is all that's needed.
//
// Red-letter DOES need alignment, because it has to land on the right
// WORD in the existing token array. The approach: render this USFM
// verse to a plain whitespace-split word list (same splitting the
// existing data was almost certainly built with), tracking which words
// fall inside \wj ... \wj* as we go. If that word list is the SAME
// LENGTH as the existing verse's token array, tag by position. If not
// (rare formatting divergence), skip that one verse's red-letter rather
// than guess -- reported at the end so real coverage is known, not
// assumed.

import fs from "fs";
import path from "path";

const USFM_DIR = "/home/claude/kjv_usfm";
const KJV_DIR = "/home/claude/data/bible/kjv_overlaid"; // write here first, verify, then promote
fs.mkdirSync(KJV_DIR, { recursive: true });
const EXISTING_KJV_DIR = "/home/claude/data/bible/kjv";

function stripWordMarkers(text) {
  // \w word|strong="H1234"\w*  and  \+w word|strong="G5678"\+w*
  // both just mean "this word carries this Strong's number" -- for our
  // purposes here we only need the bare word text back.
  return text.replace(/\\\+?w\s+([^|]+?)\|strong="[^"]*"\\\+?w\*/g, "$1");
}

function extractFootnotesAndStrip(verseText) {
  const footnotes = [];
  const stripped = verseText.replace(/\\f\s+\+?\s*([\s\S]*?)\\f\*/g, (whole, inner) => {
    // Inner is typically: \fr 1.1 \ft ruled: Heb. judged
    // \fr is the reference (redundant -- we already have book/ch/verse),
    // \ft is the actual note text. Grab every \ft segment.
    const ftMatches = [...inner.matchAll(/\\ft\s+([^\\]*)/g)];
    const text = ftMatches.map((m) => m[1].trim()).join(" ").trim();
    if (text) footnotes.push(text);
    return " ";
  });
  return { stripped, footnotes };
}

// Returns [{ word, red }] in reading order for one verse's raw USFM text.
function wordsWithRedFlag(verseText) {
  // Mark red-letter boundaries with sentinels BEFORE stripping word
  // markers (so \wj sitting right next to \+w isn't disturbed).
  let t = verseText
    .replace(/\\wj\*/g, "\u0002")
    .replace(/\\wj\b/g, "\u0001");
  t = stripWordMarkers(t);
  // Strip remaining structural/character markup, keeping enclosed text:
  // \add ...\add*, \nd ...\nd*, \qs ...\qs*, and bare paragraph/poetry
  // markers (\p, \q1, \q2, \m, \b) and the pilcrow paragraph mark.
  // These character-style markers can ALSO appear "+"-prefixed when
  // nested inside another character style -- e.g. \+add ... \+add*
  // for a supplied word inside a \wj (red-letter) span. Both forms mean
  // the same thing; \+? on each covers both without duplicating rules.
  t = t.replace(/\\\+?(add|nd|qs|em|bd|it)\*/g, "").replace(/\\\+?(add|nd|qs|em|bd|it)\b/g, "");
  t = t.replace(/\\\+?[a-z][a-z0-9]*\b\*?/gi, " "); // any leftover marker, "+"-prefixed or not
  t = t.replace(/¶/g, " ");
  t = t.replace(/\s+/g, " ").trim();

  const words = [];
  let red = false;
  for (const piece of t.split(" ")) {
    if (!piece) continue;
    let w = piece;
    // Leading sentinels ("\wj Blessed...") change state BEFORE this word.
    while (w.length && (w[0] === "\u0001" || w[0] === "\u0002")) {
      red = w[0] === "\u0001";
      w = w.slice(1);
    }
    // Trailing sentinels ("...heaven.\wj*") change state AFTER this word
    // -- the source often closes \wj right against the final word with
    // no space, so the word itself is still inside the red span and
    // must be pushed under the CURRENT state before red flips off.
    const trailing = [];
    while (w.length && (w[w.length - 1] === "\u0001" || w[w.length - 1] === "\u0002")) {
      trailing.unshift(w[w.length - 1]);
      w = w.slice(0, -1);
    }
    // Rare: a sentinel strictly inside a word -- split at it rather than
    // silently dropping half the word.
    if (/[\u0001\u0002]/.test(w)) {
      for (const part of w.split(/([\u0001\u0002])/)) {
        if (part === "\u0001") { red = true; continue; }
        if (part === "\u0002") { red = false; continue; }
        if (part) words.push({ word: part, red });
      }
    } else if (w) {
      words.push({ word: w, red });
    }
    for (const sentinel of trailing) red = sentinel === "\u0001";
  }
  return words;
}

function parseUsfmBook(raw) {
  // Split into verse-sized chunks: everything from one \v N up to the
  // next \v, \c, or end of file. \c changes the current chapter.
  const chapters = {}; // { chNum: { verseNum: { words, footnotes } } }
  let curChapter = null;

  const chapterSplit = raw.split(/\\c\s+(\d+)\b/);
  // chapterSplit[0] is front matter before chapter 1 -- discard.
  for (let i = 1; i < chapterSplit.length; i += 2) {
    curChapter = chapterSplit[i];
    const chapterText = chapterSplit[i + 1] || "";
    const verseSplit = chapterText.split(/\\v\s+(\d+)\b/);
    chapters[curChapter] = {};
    for (let j = 1; j < verseSplit.length; j += 2) {
      const vNum = verseSplit[j];
      const vText = verseSplit[j + 1] || "";
      const { stripped, footnotes } = extractFootnotesAndStrip(vText);
      const words = wordsWithRedFlag(stripped);
      chapters[curChapter][vNum] = { words, footnotes };
    }
  }
  return chapters;
}

const files = fs.readdirSync(USFM_DIR).filter((f) => f.endsWith(".usfm"));
const report = [];

for (const file of files) {
  const m = file.match(/^\d+-([A-Z0-9]+)eng-kjv2006\.usfm$/);
  if (!m) { console.error(`SKIP (no code match): ${file}`); continue; }
  const usfmCode = m[1];

  // Reuse the existing KJV files' own abbreviations -- find by matching
  // USFM code to abbr via the same table used for BSB (kept in sync;
  // duplicated here deliberately rather than importing app code into a
  // standalone script).
  const USFM_TO_APP = {
    GEN: "Gen", EXO: "Exo", LEV: "Lev", NUM: "Num", DEU: "Deu", JOS: "Jos", JDG: "Jdg", RUT: "Rth",
    "1SA": "1Sa", "2SA": "2Sa", "1KI": "1Ki", "2KI": "2Ki", "1CH": "1Ch", "2CH": "2Ch", EZR: "Ezr", NEH: "Neh",
    EST: "Est", JOB: "Job", PSA: "Psa", PRO: "Pro", ECC: "Ecc", SNG: "Sng", ISA: "Isa", JER: "Jer",
    LAM: "Lam", EZK: "Eze", DAN: "Dan", HOS: "Hos", JOL: "Joe", AMO: "Amo", OBA: "Oba", JON: "Jon",
    MIC: "Mic", NAM: "Nah", HAB: "Hab", ZEP: "Zep", HAG: "Hag", ZEC: "Zec", MAL: "Mal",
    MAT: "Mat", MRK: "Mar", LUK: "Luk", JHN: "Jhn", ACT: "Act", ROM: "Rom", "1CO": "1Co", "2CO": "2Co",
    GAL: "Gal", EPH: "Eph", PHP: "Phl", COL: "Col", "1TH": "1Th", "2TH": "2Th", "1TI": "1Ti", "2TI": "2Ti",
    TIT: "Tit", PHM: "Phm", HEB: "Heb", JAS: "Jas", "1PE": "1Pe", "2PE": "2Pe", "1JN": "1Jo", "2JN": "2Jo",
    "3JN": "3Jo", JUD: "Jde", REV: "Rev",
  };
  const abbr = USFM_TO_APP[usfmCode];
  if (!abbr) { console.error(`SKIP (no abbr mapping): ${usfmCode}`); continue; }

  const raw = fs.readFileSync(path.join(USFM_DIR, file), "utf-8");
  const usfmChapters = parseUsfmBook(raw);

  const existingPath = path.join(EXISTING_KJV_DIR, `${abbr}.json`);
  const existing = JSON.parse(fs.readFileSync(existingPath, "utf-8"));

  let redAppliedVerses = 0, redSkippedVerses = 0, footnoteCount = 0;
  const footnotesOut = {};

  for (const [chNum, verses] of Object.entries(existing.chapters)) {
    const usfmCh = usfmChapters[chNum];
    for (const [vNum, tokens] of Object.entries(verses)) {
      const usfmV = usfmCh?.[vNum];
      if (!usfmV) continue; // no matching verse in this source -- leave untouched

      if (usfmV.footnotes.length) {
        footnotesOut[chNum] ??= {};
        footnotesOut[chNum][vNum] = usfmV.footnotes;
        footnoteCount += usfmV.footnotes.length;
      }

      if (usfmV.words.length === tokens.length) {
        let anyRed = false;
        tokens.forEach((tok, i) => {
          if (usfmV.words[i].red) { tok.r = true; anyRed = true; }
        });
        if (anyRed) redAppliedVerses++;
      } else if (usfmV.words.some((w) => w.red)) {
        // Only worth counting as "skipped" if this verse actually HAD
        // red-letter words to apply -- a length mismatch on a verse
        // with no red-letter content is harmless and not worth a report line.
        redSkippedVerses++;
      }
    }
  }

  existing.footnotes = footnotesOut;
  fs.writeFileSync(path.join(KJV_DIR, `${abbr}.json`), JSON.stringify(existing));
  report.push({ abbr, redAppliedVerses, redSkippedVerses, footnoteCount });
}

console.log(`Processed ${report.length} books -> ${KJV_DIR}`);
const totals = report.reduce(
  (a, r) => ({
    red: a.red + r.redAppliedVerses,
    skipped: a.skipped + r.redSkippedVerses,
    fn: a.fn + r.footnoteCount,
  }),
  { red: 0, skipped: 0, fn: 0 }
);
console.log(`TOTALS: ${totals.red} verses with red-letter applied, ${totals.skipped} skipped (word-count mismatch), ${totals.fn} footnotes captured`);
console.table(report.filter((r) => r.redSkippedVerses > 0 || r.redAppliedVerses > 0));
