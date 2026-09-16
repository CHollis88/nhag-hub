import { NextResponse } from "next/server";
import { getBrowseEntries } from "@/lib/bible";
import { withPublicCache } from "@/lib/cacheHeaders";

const VALID_SOURCES = ["easton", "smith", "hitchcock", "torrey", "webster", "strongs-hebrew", "strongs-greek"];

export async function GET(req) {
  const source = req.nextUrl.searchParams.get("source");
  const letter = req.nextUrl.searchParams.get("letter");

  if (!source || !VALID_SOURCES.includes(source) || !letter || letter.length !== 1) {
    return NextResponse.json({ error: "A valid source and single letter are required." }, { status: 400 });
  }

  const entries = getBrowseEntries(source, letter);
  return withPublicCache({ entries });
}
