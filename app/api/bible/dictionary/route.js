import { NextResponse } from "next/server";
import { searchDictionary, getDictionaryEntry } from "@/lib/bible";
import { withPublicCache } from "@/lib/cacheHeaders";

export async function GET(req) {
  const q = req.nextUrl.searchParams.get("q");
  const exact = req.nextUrl.searchParams.get("word");

  if (exact) {
    const entry = getDictionaryEntry(exact);
    if (!entry) return NextResponse.json({ error: "No entry found." }, { status: 404 });
    return withPublicCache({ entry });
  }

  if (!q || !q.trim()) {
    return withPublicCache({ easton: [], webster: [], hitchcock: [], smith: [], torrey: [] });
  }

  const results = searchDictionary(q);
  return withPublicCache(results);
}
