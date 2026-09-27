import { NextResponse } from "next/server";
import { getBrowseEntries } from "@/lib/bible";
import { withPublicCache } from "@/lib/cacheHeaders";

// Must include every dictionary lib/bible.js loads -- "tyndale" and
// "tyndale-themes" were missing here, so browsing either one got a 400
// and the Browse tab sat on "Loading..." forever.
const VALID_SOURCES = [
  "easton", "smith", "hitchcock", "torrey", "webster",
  "tyndale", "tyndale-themes",
  "strongs-hebrew", "strongs-greek",
];

export async function GET(req) {
  const source = req.nextUrl.searchParams.get("source");
  const letter = req.nextUrl.searchParams.get("letter");

  if (!source || !VALID_SOURCES.includes(source) || !letter || letter.length !== 1) {
    return NextResponse.json({ error: "A valid source and single letter are required." }, { status: 400 });
  }

  const entries = getBrowseEntries(source, letter);
  return withPublicCache({ entries });
}
