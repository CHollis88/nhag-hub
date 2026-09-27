import { NextResponse } from "next/server";
import { isValidBook, getCrossRefs, getCommentaryForVerse, DEFAULT_COMMENTARY_SOURCE, isValidCommentarySource } from "@/lib/bible";
import { withPublicCache } from "@/lib/cacheHeaders";

export async function GET(req) {
  const book = req.nextUrl.searchParams.get("book");
  const chapter = req.nextUrl.searchParams.get("chapter");
  const verse = req.nextUrl.searchParams.get("verse");
  const source = req.nextUrl.searchParams.get("source") || DEFAULT_COMMENTARY_SOURCE;

  if (!book || !chapter || !verse || !isValidBook(book)) {
    return NextResponse.json({ error: "A valid book, chapter, and verse are required." }, { status: 400 });
  }
  if (!isValidCommentarySource(source)) {
    return NextResponse.json({ error: "Unknown commentary source." }, { status: 400 });
  }

  const refs = getCrossRefs(book, chapter, verse);
  const commentary = getCommentaryForVerse(book, chapter, verse, source);
  return withPublicCache({ book, chapter, verse, source, commentary });
}
