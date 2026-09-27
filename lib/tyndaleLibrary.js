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
 *   intro         -- book summary, chapter 1 only (drives the in-text card)
 *   book          -- book summary on EVERY chapter (drives the Study Panel)
 *   themes        -- theme notes whose passage STARTS in this chapter
 *   activeThemes  -- theme notes that started earlier and run through it
 *
 * The in-text card only shows `themes` (where each one begins): some run
 * 20+ chapters, and repeating the same chip in the text on every one
 * would be noise. The Study Panel has room for both.
 */
export function getChapterExtras(book, chapter) {
  const ch = parseInt(chapter, 10);
  const b = intros()[book];
  const summary = b ? { book, title: b.title, summary: b.summary } : null;
  const all = themes().filter((t) => t.ref && t.ref.book === book);
  const pick = (t) => ({ id: t.id, title: t.title, ref: t.ref });
  return {
    intro: ch === 1 ? summary : null,
    book: summary,
    themes: all.filter((t) => t.ref.c1 === ch).map(pick),
    activeThemes: all.filter((t) => t.ref.c1 < ch && t.ref.c2 >= ch).map(pick),
  };
}
