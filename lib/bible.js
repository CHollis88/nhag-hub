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

let commentaryCache = null;
export function getCommentary(bookAbbr, chapter) {
  if (!commentaryCache) commentaryCache = readJson("matthew-henry-concise.json");
  return commentaryCache[`${bookAbbr}|${chapter}`] || [];
}

// Used for the Study Panel's verse-tap view -- narrows the chapter's full
// commentary down to just the note(s) whose verse range covers this one
// specific verse.
export function getCommentaryForVerse(bookAbbr, chapter, verse) {
  const all = getCommentary(bookAbbr, chapter);
  const v = parseInt(verse, 10);
  return all.filter((n) => v >= n.v1 && v <= n.v2);
}

let crossRefsCache = null;
export function getCrossRefs(bookAbbr, chapter, verse) {
  if (!crossRefsCache) crossRefsCache = readJson("cross-references.json");
  return crossRefsCache[`${bookAbbr}|${chapter}|${verse}`] || [];
}

let dictionaryCache = null;
let websterCache = null;
let hitchcockCache = null;
let smithCache = null;
let torreyCache = null;

function loadAllDictionaries() {
  if (!dictionaryCache) dictionaryCache = readJson("eastons-dictionary.json");
  if (!websterCache) websterCache = readJson("websters1828.json");
  if (!hitchcockCache) hitchcockCache = readJson("hitchcocks.json");
  if (!smithCache) smithCache = readJson("smiths.json");
  if (!torreyCache) torreyCache = readJson("torreys.json");
  return {
    easton: dictionaryCache,
    webster: websterCache,
    hitchcock: hitchcockCache,
    smith: smithCache,
    torrey: torreyCache,
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

const DICTIONARY_SOURCES = ["easton", "smith", "hitchcock", "torrey", "webster"];

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


