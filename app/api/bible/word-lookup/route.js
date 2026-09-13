import { NextResponse } from "next/server";
import { getExactMatchesAcrossDictionaries } from "@/lib/bible";

export async function GET(req) {
  const word = req.nextUrl.searchParams.get("word");
  if (!word || !word.trim()) {
    return NextResponse.json({ error: "word is required." }, { status: 400 });
  }
  const matches = getExactMatchesAcrossDictionaries(word);
  return NextResponse.json({ matches });
}
