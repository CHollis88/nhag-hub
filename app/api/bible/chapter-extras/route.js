import { NextResponse } from "next/server";
import { isValidBook } from "@/lib/bible";
import { withPublicCache } from "@/lib/cacheHeaders";
import { getChapterExtras } from "@/lib/tyndaleLibrary";

// Study-mode extras for the chapter being read: the book's intro summary
// (chapter 1 only) and theme notes that begin in this chapter. Not
// translation-specific -- this content is about the passage, not any
// one translation's wording, so it's the same on KJV, ESV, NLT, and BSB.
export async function GET(req) {
  const book = req.nextUrl.searchParams.get("book");
  const chapter = req.nextUrl.searchParams.get("chapter");
  if (!book || !chapter || !isValidBook(book)) {
    return NextResponse.json({ error: "A valid book and chapter are required." }, { status: 400 });
  }
  return withPublicCache(getChapterExtras(book, chapter));
}
