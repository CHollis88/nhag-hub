import { NextResponse } from "next/server";
import { searchDictionary, getDictionaryEntry } from "@/lib/bible";

export async function GET(req) {
  const q = req.nextUrl.searchParams.get("q");
  const exact = req.nextUrl.searchParams.get("word");

  if (exact) {
    const entry = getDictionaryEntry(exact);
    if (!entry) return NextResponse.json({ error: "No entry found." }, { status: 404 });
    return NextResponse.json({ entry });
  }

  if (!q || !q.trim()) {
    return NextResponse.json({ easton: [], webster: [], hitchcock: [], smith: [], torrey: [] });
  }

  const results = searchDictionary(q);
  return NextResponse.json(results);
}
