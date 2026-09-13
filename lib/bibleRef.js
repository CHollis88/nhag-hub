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

export const ABBR_TO_NAME = Object.fromEntries(BOOKS);
const NAME_TO_ABBR = Object.fromEntries(BOOKS.map(([abbr, name]) => [name, abbr]));

// Extra common aliases/abbreviations people actually type, mapped to the
// canonical abbreviation used elsewhere in the app.
const ALIASES = {
  gen: "Gen", ge: "Gen", exo: "Exo", ex: "Exo", lev: "Lev", le: "Lev",
  num: "Num", nu: "Num", deut: "Deu", dt: "Deu", josh: "Jos",
  judg: "Jdg", jdgs: "Jdg", ruth: "Rth", "1sam": "1Sa", "1 sam": "1Sa",
  "2sam": "2Sa", "2 sam": "2Sa", "1kgs": "1Ki", "1 kgs": "1Ki",
  "2kgs": "2Ki", "2 kgs": "2Ki", "1chr": "1Ch", "1 chr": "1Ch",
  "2chr": "2Ch", "2 chr": "2Ch", ezra: "Ezr", neh: "Neh", esth: "Est",
  ps: "Psa", psalm: "Psa", psalms: "Psa", prov: "Pro", eccl: "Ecc",
  eccles: "Ecc", song: "Sng", songs: "Sng", sos: "Sng", isa: "Isa",
  jer: "Jer", lam: "Lam", ezek: "Eze", dan: "Dan", hos: "Hos",
  joel: "Joe", amos: "Amo", obad: "Oba", jonah: "Jon", mic: "Mic",
  nah: "Nah", hab: "Hab", zeph: "Zep", hag: "Hag", zech: "Zec",
  mal: "Mal", matt: "Mat", mt: "Mat", mk: "Mar", mrk: "Mar",
  lk: "Luk", jn: "Jhn", jhn: "Jhn", acts: "Act", rom: "Rom",
  "1cor": "1Co", "1 cor": "1Co", "2cor": "2Co", "2 cor": "2Co",
  gal: "Gal", eph: "Eph", phil: "Phl", php: "Phl", col: "Col",
  "1thess": "1Th", "1 thess": "1Th", "2thess": "2Th", "2 thess": "2Th",
  "1tim": "1Ti", "1 tim": "1Ti", "2tim": "2Ti", "2 tim": "2Ti",
  titus: "Tit", phlm: "Phm", philem: "Phm", heb: "Heb", jas: "Jas",
  jam: "Jas", "1pet": "1Pe", "1 pet": "1Pe", "2pet": "2Pe", "2 pet": "2Pe",
  "1john": "1Jo", "1 john": "1Jo", "2john": "2Jo", "2 john": "2Jo",
  "3john": "3Jo", "3 john": "3Jo", jude: "Jde", rev: "Rev",
};

const LOOKUP = (() => {
  const map = {};
  for (const [abbr, name] of BOOKS) {
    map[abbr.toLowerCase()] = abbr;
    map[name.toLowerCase()] = abbr;
  }
  for (const [alias, abbr] of Object.entries(ALIASES)) {
    map[alias] = abbr;
  }
  return map;
})();

// Loosely parses whatever someone types into a quick "jump to" box —
// "john 3:16", "jn 3", "1 cor 13:4", "genesis 1" — into
// { bookAbbr, bookName, chapter, verse } or null if it can't confidently
// resolve the book name. Never guesses at an ambiguous or unknown book.
export function parseQuickReference(input) {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase().replace(/\s+/g, " ");
  const m = trimmed.match(/^([1-3]?\s?[a-z]+)\.?\s*(\d+)?(?::(\d+))?$/);
  if (!m) return null;
  const [, rawBook, chapterStr, verseStr] = m;
  const abbr = LOOKUP[rawBook.trim()];
  if (!abbr) return null;
  return {
    bookAbbr: abbr,
    bookName: ABBR_TO_NAME[abbr],
    chapter: chapterStr ? parseInt(chapterStr, 10) : 1,
    verse: verseStr ? parseInt(verseStr, 10) : null,
  };
}

// Converts a stored reference like "Jhn 1:1" or "Heb 11:3-5" into a
// friendly, fully-spelled-out display string like "John 1:1".
export function formatReference(ref) {
  const m = ref.match(/^(\w+)(\s+.*)$/);
  if (!m) return ref;
  const [, abbr, rest] = m;
  const fullName = ABBR_TO_NAME[abbr];
  return fullName ? `${fullName}${rest}` : ref;
}

// Parses a reading-plan reference like "Genesis 1-4" or "Matthew 6" into
// { bookAbbr, bookName, startChapter, endChapter }. Returns null if it
// can't confidently parse (never guesses at a wrong passage).
export function parseReference(ref) {
  if (!ref) return null;
  const m = ref.match(/^(.+?)\s+(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  const [, name, start, end] = m;
  const abbr = NAME_TO_ABBR[name.trim()];
  if (!abbr) return null;
  return {
    bookAbbr: abbr,
    bookName: name.trim(),
    startChapter: parseInt(start, 10),
    endChapter: end ? parseInt(end, 10) : parseInt(start, 10),
  };
}
