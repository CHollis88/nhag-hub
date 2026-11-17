import { NextResponse } from "next/server";
import { getLocalChapter } from "@/lib/bible";
import { tokensToText, ABBR_TO_NAME } from "@/lib/bibleRef";
import { verseRefForDate } from "@/lib/verseOfDay";

// Home's Verse of the Day. Public Bible text (KJV / BSB, both stored in the
// app) and the same answer for everyone on a given date, so it's cached by
// the phone AND Vercel's edge for the day: the server function runs about
// once a day per translation, not once per person.
//   GET /api/bible/verse-of-day?date=2026-11-17&translation=kjv|bsb
export async function GET(req) {
  const date = req.nextUrl.searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "date must be YYYY-MM-DD." }, { status: 400 });
  const translation = req.nextUrl.searchParams.get("translation") === "bsb" ? "bsb" : "kjv";

  const { book, chapter, verse } = verseRefForDate(date);
  const tokens = getLocalChapter(translation, book, chapter)?.[String(verse)];
  if (!tokens) return NextResponse.json({ error: "Verse not found." }, { status: 404 });

  const res = NextResponse.json(
    {
      date,
      translation,
      book,
      chapter,
      verse,
      reference: `${ABBR_TO_NAME[book] || book} ${chapter}:${verse}`,
      text: tokensToText(tokens.filter((t) => !t.ti)).replace(/\s+/g, " ").trim(), // without a Psalm's title
    },
  );
  // s-maxage is what lets Vercel's edge keep it (max-age alone is only the
  // phone's own cache). The URL includes the date, so a day is safe.
  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400");
  return res;
}
