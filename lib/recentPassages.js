const KEY = "sp_bible_recent";
const MAX_ENTRIES = 8;

export function getRecentPassages() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

// Most-recent-first, deduplicated by book+chapter (revisiting a passage
// moves it back to the front rather than creating a second entry), capped
// at MAX_ENTRIES so this stays a short, useful list rather than a full
// history log.
export function addRecentPassage(bookAbbr, chapter) {
  if (typeof window === "undefined") return;
  const existing = getRecentPassages();
  const filtered = existing.filter((p) => !(p.bookAbbr === bookAbbr && p.chapter === chapter));
  const next = [{ bookAbbr, chapter, at: Date.now() }, ...filtered].slice(0, MAX_ENTRIES);
  localStorage.setItem(KEY, JSON.stringify(next));
}
