import { NextResponse } from "next/server";
import { isValidBook, getKjvChapter, getPericopes } from "@/lib/bible";
import { withPublicCache } from "@/lib/cacheHeaders";

export async function GET(req) {
  const book = req.nextUrl.searchParams.get("book");
  const chapter = req.nextUrl.searchParams.get("chapter");

  if (!book || !chapter || !isValidBook(book)) {
    return NextResponse.json({ error: "A valid book and chapter are required." }, { status: 400 });
  }

  const verses = getKjvChapter(book, chapter);
  if (!verses) return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
  const headings = getPericopes(book, chapter);
  return withPublicCache({ book, chapter, verses, headings });
}
