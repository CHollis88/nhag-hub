// One-time build script: BSB_full_strongs_usj/*.usj -> data/bible/bsb/<Abbr>.json
//
// Run once against the BSB-publishing release data. Not part of the app's
// runtime -- output is committed to data/bible/bsb/ and read the same way
// KJV is (see lib/bible.js getLocalChapter).
//
// Source shape (USJ v3, confirmed against the real v5.12 release files):
// a flat `content` array of book/chapter/verse/para/char/note nodes,
// walked depth-first in document order. Verse and chapter boundaries are
// IMPLICIT -- there's no end marker, so "current chapter/verse" is state
// carried across the whole walk, not scoped to one paragraph.
//
// Known source quirks handled here:
//   - `content: ["vvv"]` and `content: ["-"]` on a `char/w` node mean the
//     aligned Hebrew/Greek word contributes no separate English text (it's
//     folded into a neighboring word's phrase, e.g. a negation particle).
//     These tokens are dropped entirely -- there's nothing to render.
//   - `char/wj` wraps a run of nested char nodes that are Jesus' words
//     (red-letter). It has no text of its own; recurse into its content
//     with a red-letter flag set.
//   - `note/f` (footnotes) and `para/r` (the cross-reference line under a
//     section heading, e.g. "(Ruth 4:18-22; Luke 3:23-38)") are skipped
//     entirely from the verse text -- footnotes are captured separately;
//     the `r` cross-ref line is redundant with the app's own cross-ref
//     data and was never meant to be read as scripture text.
//   - `para/s1` is the section heading. Captured and attached to the
//     NEXT verse encountered, same convention as pericopes.json.
//   - Multi-word `content` on a `char/w` node (e.g. "in the days" under
//     one Strong's number) is kept as ONE token, not split into three
//     separate words each carrying the same number. This is actually
//     more accurate than KJV's per-word tagging for cases where a
//     single Hebrew/Greek word became a whole English phrase.

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const SRC_DIR = "/home/claude/bsb_full";
const OUT_DIR = "/home/claude/data/bible/bsb";
fs.mkdirSync(OUT_DIR, { recursive: true });

// USFM 3-letter code -> this app's abbreviation + full name (matches
// lib/bibleRef.js BOOKS exactly, including its non-obvious cases like
// Rth/Eze/Joe/Nah/Mar/Phl/Jde/1Jo/2Jo/3Jo).
const USFM_TO_APP = {
  GEN: ["Gen", "Genesis"], EXO: ["Exo", "Exodus"], LEV: ["Lev", "Leviticus"], NUM: ["Num", "Numbers"],
  DEU: ["Deu", "Deuteronomy"], JOS: ["Jos", "Joshua"], JDG: ["Jdg", "Judges"], RUT: ["Rth", "Ruth"],
  "1SA": ["1Sa", "1 Samuel"], "2SA": ["2Sa", "2 Samuel"], "1KI": ["1Ki", "1 Kings"], "2KI": ["2Ki", "2 Kings"],
  "1CH": ["1Ch", "1 Chronicles"], "2CH": ["2Ch", "2 Chronicles"], EZR: ["Ezr", "Ezra"], NEH: ["Neh", "Nehemiah"],
  EST: ["Est", "Esther"], JOB: ["Job", "Job"], PSA: ["Psa", "Psalms"], PRO: ["Pro", "Proverbs"],
  ECC: ["Ecc", "Ecclesiastes"], SNG: ["Sng", "Song of Solomon"], ISA: ["Isa", "Isaiah"], JER: ["Jer", "Jeremiah"],
  LAM: ["Lam", "Lamentations"], EZK: ["Eze", "Ezekiel"], DAN: ["Dan", "Daniel"], HOS: ["Hos", "Hosea"],
  JOL: ["Joe", "Joel"], AMO: ["Amo", "Amos"], OBA: ["Oba", "Obadiah"], JON: ["Jon", "Jonah"],
  MIC: ["Mic", "Micah"], NAM: ["Nah", "Nahum"], HAB: ["Hab", "Habakkuk"], ZEP: ["Zep", "Zephaniah"],
  HAG: ["Hag", "Haggai"], ZEC: ["Zec", "Zechariah"], MAL: ["Mal", "Malachi"],
  MAT: ["Mat", "Matthew"], MRK: ["Mar", "Mark"], LUK: ["Luk", "Luke"], JHN: ["Jhn", "John"],
  ACT: ["Act", "Acts"], ROM: ["Rom", "Romans"], "1CO": ["1Co", "1 Corinthians"], "2CO": ["2Co", "2 Corinthians"],
  GAL: ["Gal", "Galatians"], EPH: ["Eph", "Ephesians"], PHP: ["Phl", "Philippians"], COL: ["Col", "Colossians"],
  "1TH": ["1Th", "1 Thessalonians"], "2TH": ["2Th", "2 Thessalonians"], "1TI": ["1Ti", "1 Timothy"], "2TI": ["2Ti", "2 Timothy"],
  TIT: ["Tit", "Titus"], PHM: ["Phm", "Philemon"], HEB: ["Heb", "Hebrews"], JAS: ["Jas", "James"],
  "1PE": ["1Pe", "1 Peter"], "2PE": ["2Pe", "2 Peter"], "1JN": ["1Jo", "1 John"], "2JN": ["2Jo", "2 John"],
  "3JN": ["3Jo", "3 John"], JUD: ["Jde", "Jude"], REV: ["Rev", "Revelation"],
};

function isPlaceholder(text) {
  const t = text.trim();
  return t === "vvv" || t === "-";
}

// Depth-first walk over one book's `content` array, in document order.
// Returns { chapters, headings, footnotes }.
function walkBook(content) {
  const chapters = {};
  const headings = {};
  const footnotes = {};
  let curChapter = null;
  let curVerse = null;
  let pendingHeading = null;
  let inRedLetter = false;
  let skipDepth = 0; // >0 while inside a note/f or para/r subtree

  function pushToken(text, strong) {
    if (curChapter == null || curVerse == null) return; // front matter before ch.1
    if (!text || isPlaceholder(text)) {
      // Even a dropped placeholder token can carry a pending bracket
      // (rare, but don't silently eat the bracket if it does) -- push it
      // forward rather than discarding it.
      return;
    }
    const s = strong ? [strong] : [];
    const key = String(curVerse);
    chapters[curChapter] ??= {};
    chapters[curChapter][key] ??= [];
    const finalText = pendingPrefix ? pendingPrefix + text : text;
    pendingPrefix = "";
    const tok = { t: finalText, s };
    if (inRedLetter) tok.r = true;
    chapters[curChapter][key].push(tok);
  }

  function pushFootnote(text) {
    if (curChapter == null || curVerse == null) return;
    footnotes[curChapter] ??= {};
    const key = String(curVerse);
    footnotes[curChapter][key] ??= [];
    footnotes[curChapter][key].push(text.trim());
  }

  // A bracket/quote opened on a bare string but not yet closed -- e.g.
  // the "[" in "[His]" arrives as its own string, then "His" as a
  // separate w-token, then "]" as another bare string. Without this,
  // each becomes its own token and the reader shows "[ His ]" with
  // stray spaces the source never intended. Held here and prepended to
  // the next real token instead.
  let pendingPrefix = "";

  function walk(node) {
    if (typeof node === "string") {
      // Bare punctuation/whitespace between char nodes. Fuse trailing
      // punctuation onto the previous token so "ruled" + "," reads as
      // "ruled," -- matching how the KJV data already stores it -- and
      // drop pure whitespace, which the reader joins with a space anyway.
      if (skipDepth > 0) return;
      const trimmed = node.trim();
      if (!trimmed) return;
      if (curChapter == null || curVerse == null) return;
      const key = String(curVerse);
      const arr = chapters[curChapter]?.[key];
      // Opening bracket/quote: hold it, don't emit a token -- it belongs
      // stuck to the FRONT of whatever comes next.
      if (/^[[("‘“]+$/.test(trimmed)) {
        pendingPrefix += trimmed;
        return;
      }
      // Closing bracket/quote or trailing punctuation (comma, period,
      // semicolon, colon, em dash) attaches to the END of the previous
      // word instead of floating as its own token.
      if (arr && arr.length && /^[,.;:!?"'\u2019\u201d)\]\u2014-]/.test(trimmed)) {
        arr[arr.length - 1].t += trimmed;
        return;
      }
      if (/\S/.test(trimmed)) pushToken(trimmed, null);
      return;
    }
    if (!node || typeof node !== "object") return;

    if (node.type === "chapter" && node.marker === "c") {
      curChapter = node.number;
      curVerse = null;
      return;
    }
    if (node.type === "verse" && node.marker === "v") {
      curVerse = node.number;
      if (pendingHeading) {
        headings[curChapter] ??= {};
        headings[curChapter][String(curVerse)] = pendingHeading;
        pendingHeading = null;
      }
      return;
    }
    if (node.type === "note") {
      // Footnote subtree: capture its text (fr/ft/fqa chars), don't let
      // it fall into the verse's own text.
      const parts = [];
      (function collect(n) {
        if (typeof n === "string") { if (n.trim()) parts.push(n.trim()); return; }
        if (Array.isArray(n)) return n.forEach(collect);
        if (n && n.content) collect(n.content);
      })(node.content);
      const text = parts.join(" ").replace(/\s+/g, " ").trim();
      if (text) pushFootnote(text);
      return; // do not recurse further as normal text
    }
    if (node.type === "para" && node.marker === "r") {
      return; // cross-ref line under a heading -- not scripture text
    }
    if (node.type === "para" && node.marker === "s1") {
      const parts = [];
      (function collect(n) {
        if (typeof n === "string") { parts.push(n); return; }
        if (Array.isArray(n)) return n.forEach(collect);
        if (n && n.content) collect(n.content);
      })(node.content);
      pendingHeading = parts.join(" ").replace(/\s+/g, " ").trim();
      return;
    }
    if (node.type === "char" && node.marker === "wj") {
      const wasRed = inRedLetter;
      inRedLetter = true;
      if (Array.isArray(node.content)) node.content.forEach(walk);
      inRedLetter = wasRed;
      return;
    }
    if (node.type === "char" && (node.marker === "w" || node.marker === "add")) {
      const text = Array.isArray(node.content) ? node.content.join(" ") : "";
      pushToken(text.trim(), node.marker === "w" ? node.strong : null);
      return;
    }
    if (node.type === "ref") {
      return; // cross-reference markup (e.g. inside r-lines) -- skip
    }
    // Generic container (book/para/other char types): recurse into content.
    if (Array.isArray(node.content)) node.content.forEach(walk);
  }

  content.forEach(walk);
  return { chapters, headings, footnotes };
}

const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith(".usj"));
let done = 0;
const summary = [];

for (const file of files) {
  // Filenames are <2-digit order prefix><USFM code>BSB_full_strongs.usj,
  // e.g. 01GEN..., 091SA..., 471CO... -- strip exactly the 2-digit
  // order prefix, NOT /^\d+/, which would also eat the leading digit
  // of a book code like 1SA or 1CO.
  const usfmCode = file.slice(2).replace(/BSB_full_strongs\.usj$/, "");
  const mapped = USFM_TO_APP[usfmCode];
  if (!mapped) {
    console.error(`SKIP (no mapping): ${file} -> parsed code "${usfmCode}"`);
    continue;
  }
  const [abbr, fullName] = mapped;
  const raw = JSON.parse(fs.readFileSync(path.join(SRC_DIR, file), "utf-8"));
  const { chapters, headings, footnotes } = walkBook(raw.content);

  const chapterCount = Object.keys(chapters).length;
  const verseCount = Object.values(chapters).reduce((n, ch) => n + Object.keys(ch).length, 0);
  const headingCount = Object.values(headings).reduce((n, ch) => n + Object.keys(ch).length, 0);
  const footnoteCount = Object.values(footnotes).reduce((n, ch) => n + Object.keys(ch).length, 0);
  summary.push({ abbr, chapterCount, verseCount, headingCount, footnoteCount });

  fs.writeFileSync(
    path.join(OUT_DIR, `${abbr}.json`),
    JSON.stringify({ book: fullName, abbr, chapters, headings, footnotes })
  );
  done++;
}

console.log(`Wrote ${done}/${files.length} books to ${OUT_DIR}`);
console.table(summary);
