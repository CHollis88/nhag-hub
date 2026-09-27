import fs from "fs";
import path from "path";

// Server-only loaders for the Tyndale study-Bible content built by
// scripts/build-tyndale-library.py (CC BY-SA 4.0, Tyndale House
// Publishers). Each file is read once per server instance, lazily.
//
// Paths are written out literally (not built from a variable) so
// Next's file tracing reliably bundles these files into the Vercel
// function -- same approach as app/api/bible/glossary/route.js.

let introsCache = null;
let themesCache = null;
let articlesCache = null;
let chartsCache = null;

function load(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function intros() {
  if (!introsCache) introsCache = load(path.join(process.cwd(), "data", "bible", "tyndale-book-intros.json"));
  return introsCache;
}
function themes() {
  if (!themesCache) themesCache = load(path.join(process.cwd(), "data", "bible", "tyndale-theme-notes.json"));
  return themesCache;
}
function articles() {
  if (!articlesCache) articlesCache = load(path.join(process.cwd(), "data", "bible", "tyndale-articles.json"));
  return articlesCache;
}
function charts() {
  if (!chartsCache) chartsCache = load(path.join(process.cwd(), "data", "bible", "tyndale-charts.json"));
  return chartsCache;
}

export const LIBRARY_COLLECTIONS = ["intros", "themes", "articles", "charts"];

/** Lightweight index for a Library list screen -- titles only, no bodies. */
export function getCollectionIndex(collection) {
  if (collection === "intros") {
    return Object.entries(intros()).map(([book, v]) => ({ id: book, title: v.title }));
  }
  if (collection === "themes") {
    return themes().map((t) => ({ id: t.id, title: t.title, ref: t.ref }));
  }
  if (collection === "articles") return articles().map((a) => ({ id: a.id, title: a.title }));
  if (collection === "charts") return charts().map((c) => ({ id: c.id, title: c.title }));
  return null;
}

/** One full item (with blocks) from a collection. */
export function getCollectionItem(collection, id) {
  if (collection === "intros") {
    const v = intros()[id];
    return v ? { id, ...v } : null;
  }
  const list = collection === "themes" ? themes() : collection === "articles" ? articles() : collection === "charts" ? charts() : null;
  if (!list) return null;
  return list.find((x) => x.id === id) || null;
}

/**
 * Study-mode extras for one chapter:
 *   intro   -- the book's summary (Purpose/Author/Date/Setting), chapter 1 only
 *   themes  -- theme notes whose passage STARTS in this chapter
 *
 * A theme is shown where it starts rather than on every chapter it
 * spans: some run 20+ chapters, and repeating the same essay link on
 * each would be noise. It's still reachable any time from the Library.
 */
export function getChapterExtras(book, chapter) {
  const ch = parseInt(chapter, 10);
  const intro = ch === 1 && intros()[book] ? { book, title: intros()[book].title, summary: intros()[book].summary } : null;
  const chapterThemes = themes()
    .filter((t) => t.ref && t.ref.book === book && t.ref.c1 === ch)
    .map((t) => ({ id: t.id, title: t.title, ref: t.ref }));
  return { intro, themes: chapterThemes };
}
