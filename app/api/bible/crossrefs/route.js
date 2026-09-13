import { NextResponse } from "next/server";
import { isValidBook, getCrossRefs, getCommentaryForVerse } from "@/lib/bible";

export async function GET(req) {
  const book = req.nextUrl.searchParams.get("book");
  const chapter = req.nextUrl.searchParams.get("chapter");
  const verse = req.nextUrl.searchParams.get("verse");

  if (!book || !chapter || !verse || !isValidBook(book)) {
    return NextResponse.json({ error: "A valid book, chapter, and verse are required." }, { status: 400 });
  }

  const refs = getCrossRefs(book, chapter, verse);
  const commentary = getCommentaryForVerse(book, chapter, verse);
  return NextResponse.json({ book, chapter, verse, refs, commentary });
}
