import { VERSE_OF_DAY } from "@/lib/verseOfDayList";

// Which verse a given local date ("YYYY-MM-DD") gets. Pure, so the server
// route and any test agree.
export function verseRefForDate(dateStr) {
  const m = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const day = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : Date.now();
  const n = Math.floor((day - Date.UTC(2000, 0, 1)) / 86400000);
  const ref = VERSE_OF_DAY[((n % VERSE_OF_DAY.length) + VERSE_OF_DAY.length) % VERSE_OF_DAY.length];
  const [, book, chapter, verse] = ref.match(/^(\S+) (\d+):(\d+)$/);
  return { book, chapter: Number(chapter), verse: Number(verse) };
}
