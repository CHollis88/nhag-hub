import { NextResponse } from "next/server";
import { isValidBook, getCommentary, DEFAULT_COMMENTARY_SOURCE, isValidCommentarySource } from "@/lib/bible";
import { withPublicCache } from "@/lib/cacheHeaders";

export async function GET(req) {
  const book = req.nextUrl.searchParams.get("book");
  const chapter = req.nextUrl.searchParams.get("chapter");
  const source = req.nextUrl.searchParams.get("source") || DEFAULT_COMMENTARY_SOURCE;

  if (!book || !chapter || !isValidBook(book)) {
    return NextResponse.json({ error: "A valid book and chapter are required." }, { status: 400 });
  }
  if (!isValidCommentarySource(source)) {
    return NextResponse.json({ error: "Unknown commentary source." }, { status: 400 });
  }

  const notes = getCommentary(book, chapter, source);
  return withPublicCache({ book, chapter, source, notes });
}
