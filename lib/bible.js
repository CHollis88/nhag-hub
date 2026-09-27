import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "bible");

// Standard 66-book order, used to validate book abbreviations and to know
// whether a book is OT (Hebrew/H-numbers) or NT (Greek/G-numbers).
export const BOOKS = [
  ["Gen", "Genesis"], ["Exo", "Exodus"], ["Lev", "Leviticus"], ["Num", "Numbers"],
  ["Deu", "Deuteronomy"], ["Jos", "Joshua"], ["Jdg", "Judges"], ["Rth", "Ruth"],
  ["1Sa", "1 Samuel"], ["2Sa", "2 Samuel"], ["1Ki", "1 Kings"], ["2Ki", "2 Kings"],
  ["1Ch", "1 Chronicles"], ["2Ch", "2 Chronicles"], ["Ezr", "Ezra"], ["Neh", "Nehemiah"],
  ["Est", "Esther"], ["Job", "Job"], ["Psa", "Psalms"], ["Pro", "Proverbs"],
  ["Ecc", "Ecclesiastes"], ["Sng", "Song of Solomon"], ["Isa", "Isaiah"], ["Jer", "Jeremiah"],
  ["Lam", "Lamentations"], ["Eze", "Ezekiel"], ["Dan", "Daniel"], ["Hos", "Hosea"],
  ["Joe", "Joel"], ["Amo", "Amos"], ["Oba", "Obadiah"], ["Jon", "Jonah"],
  ["Mic", "Micah"], ["Nah", "Nahum"], ["Hab", "Habakkuk"], ["Zep", "Zephaniah"],
  ["Hag", "Haggai"], ["Zec", "Zechariah"], ["Mal", "Malachi"],
  ["Mat", "Matthew"], ["Mar", "Mark"], ["Luk", "Luke"], ["Jhn", "John"],
  ["Act", "Acts"], ["Rom", "Romans"], ["1Co", "1 Corinthians"], ["2Co", "2 Corinthians"],
  ["Gal", "Galatians"], ["Eph", "Ephesians"], ["Phl", "Philippians"], ["Col", "Colossians"],
  ["1Th", "1 Thessalonians"], ["2Th", "2 Thessalonians"], ["1Ti", "1 Timothy"], ["2Ti", "2 Timothy"],
  ["Tit", "Titus"], ["Phm", "Philemon"], ["Heb", "Hebrews"], ["Jas", "James"],
  ["1Pe", "1 Peter"], ["2Pe", "2 Peter"], ["1Jo", "1 John"], ["2Jo", "2 John"],
  ["3Jo", "3 John"], ["Jde", "Jude"], ["Rev", "Revelation"],
];
const BOOK_ABBRS = new Set(BOOKS.map(([abbr]) => abbr));
const OT_ABBRS = new Set(BOOKS.slice(0, 39).map(([abbr]) => abbr));

export function isValidBook(abbr) {
  return BOOK_ABBRS.has(abbr);
}
export function isOldTestament(abbr) {
  return OT_ABBRS.has(abbr);
}

function readJson(...parts) {
  const filePath = path.join(DATA_DIR, ...parts);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

export function getKjvChapter(bookAbbr, chapter) {
  const data = readJson("kjv", `${bookAbbr}.json`);
  return data.chapters[String(chapter)] || null;
}

// Generalized version of the above, for any translation stored locally
// (currently kjv and bsb -- see lib/bibleTranslations.js `provider:
// "local"`). Unlike KJV, a local translation other than KJV carries its
// OWN headings and footnotes inline in the same file, rather than
// pulling headings from the separate pericopes.json (that file is
// specifically the KJV outline -- see getPericopes below).
function readLocalBook(translationId, bookAbbr) {
  return readJson(translationId, `${bookAbbr}.json`);
}

export function getLocalChapter(translationId, bookAbbr, chapter) {
  const data = readLocalBook(translationId, bookAbbr);
  return data.chapters[String(chapter)] || null;
}

export function getLocalHeadings(translationId, bookAbbr, chapter) {
  const data = readLocalBook(translationId, bookAbbr);
  return data.headings?.[String(chapter)] || {};
}

export function getLocalFootnotes(translationId, bookAbbr, chapter) {
  const data = readLocalBook(translationId, bookAbbr);
  return data.footnotes?.[String(chapter)] || {};
}

// Lazily builds a flat verse index (book/chapter/verse/text) across all
// 66 books the first time it's needed, then keeps it in module memory
// for the life of the server process -- same one-time-cache pattern as
// pericopeCache below. Verse text is reconstructed by joining each
// token's `t` field, since the KJV data is stored word-by-word (with
// Strong's numbers attached per word, not needed here).
let verseIndexCache = null;
function buildVerseIndex() {
  const index = [];
  for (const [abbr] of BOOKS) {
    const data = readJson("kjv", `${abbr}.json`);
    for (const chapterNum of Object.keys(data.chapters)) {
      const verses = data.chapters[chapterNum];
      for (const verseNum of Object.keys(verses)) {
        const text = verses[verseNum].map((tok) => tok.t).join(" ");
        index.push({ book: abbr, chapter: Number(chapterNum), verse: Number(verseNum), text });
      }
    }
  }
  return index;
}

/** Case-insensitive substring search across the full KJV text. */
export function searchKjv(query, { limit = 50 } = {}) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (!verseIndexCache) verseIndexCache = buildVerseIndex();

  const results = [];
  for (const entry of verseIndexCache) {
    if (entry.text.toLowerCase().includes(q)) {
      results.push(entry);
      if (results.length >= limit) break;
    }
  }
  return results;
}

let pericopeCache = null;
export function getPericopes(bookAbbr, chapter) {
  if (!pericopeCache) pericopeCache = readJson("pericopes.json");
  const result = {};
  const prefix = `${bookAbbr}|${chapter}|`;
  for (const key in pericopeCache) {
    if (key.startsWith(prefix)) {
      const verse = key.slice(prefix.length);
      result[verse] = pericopeCache[key];
    }
  }
  return result;
}

let lexiconCache = null;
export function getLexicon() {
  if (!lexiconCache) lexiconCache = readJson("strongs-lexicon.json");
  return lexiconCache;
}
export function getLexiconEntry(strongsId) {
  const lexicon = getLexicon();
  return lexicon[strongsId] || null;
}

// Two commentary sources, same shape: { "Abbr|Chapter": [{v1,v2,text}] }.
// Matthew Henry is verse-by-verse and keyed to KJV wording specifically
// (see lib/bibleTranslations.js supportsCommentary). Tyndale's Study
// Notes (scripts/build-tyndale-studynotes.py, CC BY-SA 4.0) are
// verse-RANGE keyed against the reference itself, not any translation's
// wording, so they read naturally against any translation -- which is
// why they're the default. A cross-chapter Tyndale note (a few of these
// are real, e.g. the 14-chapter Abraham narrative) was split at build
// time into one entry per chapter it touches, each with locally-valid
// v1/v2 bounds, so the same v1<=v<=v2 membership check works for both
// sources without needing to know which one produced the data.
let matthewHenryCache = null;
let tyndaleStudyNotesCache = null;

const COMMENTARY_SOURCES = {
  "matthew-henry": () => {
    if (!matthewHenryCache) matthewHenryCache = readJson("matthew-henry-concise.json");
    return matthewHenryCache;
  },
  tyndale: () => {
    if (!tyndaleStudyNotesCache) tyndaleStudyNotesCache = readJson("tyndale-studynotes.json");
    return tyndaleStudyNotesCache;
  },
};
export const DEFAULT_COMMENTARY_SOURCE = "tyndale";
export function isValidCommentarySource(source) {
  return Object.prototype.hasOwnProperty.call(COMMENTARY_SOURCES, source);
}

export function getCommentary(bookAbbr, chapter, source = DEFAULT_COMMENTARY_SOURCE) {
  const load = COMMENTARY_SOURCES[source] || COMMENTARY_SOURCES[DEFAULT_COMMENTARY_SOURCE];
  const cache = load();
  return cache[`${bookAbbr}|${chapter}`] || [];
}

// Used for the Study Panel's verse-tap view -- narrows the chapter's full
// commentary down to just the note(s) whose verse range covers this one
// specific verse.
export function getCommentaryForVerse(bookAbbr, chapter, verse, source = DEFAULT_COMMENTARY_SOURCE) {
  const all = getCommentary(bookAbbr, chapter, source);
  const v = parseInt(verse, 10);
  return all.filter((n) => v >= n.v1 && v <= n.v2);
}

let crossRefsCache = null;
const BOOK_ORDER = Object.fromEntries(BOOKS.map(([abbr], i) => [abbr, i]));

// Parses a "Book Chapter:Verse" reference string (e.g. "Jhn 3:16") into
// sortable parts. Falls back to pushing anything unparseable to the end
// rather than throwing, since this is display ordering, not validation.
function parseRefForSort(ref) {
  const match = ref.match(/^(\S+)\s+(\d+):(\d+)/);
  if (!match) return { bookIndex: 999, chapter: 0, verse: 0 };
  const [, abbr, chapter, verse] = match;
  return {
    bookIndex: BOOK_ORDER[abbr] ?? 999,
    chapter: parseInt(chapter, 10),
    verse: parseInt(verse, 10),
  };
}

export function getCrossRefs(bookAbbr, chapter, verse) {
  if (!crossRefsCache) crossRefsCache = readJson("cross-references.json");
  const refs = crossRefsCache[`${bookAbbr}|${chapter}|${verse}`] || [];
  // Sorted in canonical Bible order (Genesis -> Revelation) rather than
  // whatever order the source data happened to list them in.
  return [...refs].sort((a, b) => {
    const pa = parseRefForSort(a);
    const pb = parseRefForSort(b);
    if (pa.bookIndex !== pb.bookIndex) return pa.bookIndex - pb.bookIndex;
    if (pa.chapter !== pb.chapter) return pa.chapter - pb.chapter;
    return pa.verse - pb.verse;
  });
}

let dictionaryCache = null;
let websterCache = null;
let hitchcockCache = null;
let smithCache = null;
let torreyCache = null;
let tyndaleCache = null;
let tyndaleThemesCache = null;

function loadAllDictionaries() {
  if (!dictionaryCache) dictionaryCache = readJson("eastons-dictionary.json");
  if (!websterCache) websterCache = readJson("websters1828.json");
  if (!hitchcockCache) hitchcockCache = readJson("hitchcocks.json");
  if (!smithCache) smithCache = readJson("smiths.json");
  if (!torreyCache) torreyCache = readJson("torreys.json");
  // CC BY-SA 4.0, Tyndale House Publishers -- built by
  // scripts/build-tyndale-dictionary.py from their Open Bible
  // Dictionary (plus a gap-fill from their Profiles). Modern, far more
  // comprehensive (6,075 entries) than the five public-domain
  // dictionaries above; kept alongside them rather than replacing them,
  // since those still have their own period-appropriate value for KJV
  // word study.
  if (!tyndaleCache) tyndaleCache = readJson("tyndale-dictionary.json");
  // A distinct source, not merged into the dictionary above: these are
  // thematic essays ("The Grace of God"), not word/name definitions,
  // and occasionally overlap a dictionary entry under a different title
  // -- worth showing as its own labeled source rather than shadowing.
  if (!tyndaleThemesCache) tyndaleThemesCache = readJson("tyndale-themes.json");
  return {
    easton: dictionaryCache,
    webster: websterCache,
    hitchcock: hitchcockCache,
    smith: smithCache,
    torrey: torreyCache,
    tyndale: tyndaleCache,
    "tyndale-themes": tyndaleThemesCache,
  };
}

export function searchDictionary(query) {
  const all = loadAllDictionaries();
  const q = query.trim().toLowerCase();
  if (!q) return { easton: [], webster: [], hitchcock: [], smith: [], torrey: [] };

  const search = (list) => {
    const starts = [];
    const contains = [];
    for (const entry of list) {
      const word = entry.word.toLowerCase();
      if (word === q || word.startsWith(q)) starts.push(entry);
      else if (word.includes(q)) contains.push(entry);
    }
    return [...starts, ...contains].slice(0, 20);
  };

  const result = {};
  for (const key in all) result[key] = search(all[key]);
  return result;
}

export function getDictionaryEntry(word) {
  const all = loadAllDictionaries();
  const q = word.trim().toLowerCase();
  return all.easton.find((e) => e.word.toLowerCase() === q) || null;
}

// Used for the "Also look up" hotlinks in the Study Panel -- given a plain
// English word tapped while reading, finds any dictionaries that have an
// exact entry for it (not a fuzzy/partial search, an exact word match).
export function getExactMatchesAcrossDictionaries(word) {
  const all = loadAllDictionaries();
  const q = word.trim().toLowerCase();
  const matches = {};
  for (const key in all) {
    const entry = all[key].find((e) => e.word.toLowerCase() === q);
    if (entry) matches[key] = entry;
  }
  return matches;
}

const DICTIONARY_SOURCES = ["easton", "smith", "hitchcock", "torrey", "webster", "tyndale", "tyndale-themes"];

// Powers Concordance's Browse mode. "strongs-hebrew" and "strongs-greek" are
// browsed by transliteration (their words aren't English), everything else
// by its own word/term field.
export function getBrowseEntries(source, letter) {
  const upperLetter = letter.toUpperCase();

  if (source === "strongs-hebrew" || source === "strongs-greek") {
    const prefix = source === "strongs-hebrew" ? "H" : "G";
    const lexicon = getLexicon();
    const entries = [];
    for (const id in lexicon) {
      if (!id.startsWith(prefix)) continue;
      const entry = lexicon[id];
      const translit = entry.transliteration;
      if (translit && translit[0]?.toUpperCase() === upperLetter) {
        entries.push({
          id,
          word: translit,
          native: entry.Hb_word || entry.Gk_word,
          text: entry.strongs_def,
          partOfSpeech: entry.part_of_speech,
          rootWord: entry.root_word,
          occurrences: entry.occurrences,
          twot: entry.twot,
        });
      }
    }
    entries.sort((a, b) => a.word.localeCompare(b.word));
    return entries.slice(0, 200); // a generous cap -- keeps any one letter's response light
  }

  const all = loadAllDictionaries();
  const list = all[source];
  if (!list) return [];
  return list.filter((e) => e.word[0]?.toUpperCase() === upperLetter).slice(0, 200);
}


