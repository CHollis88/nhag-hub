// Converts a timestamp to a local calendar-date string (YYYY-MM-DD) using
// the browser's own timezone, so "today" matches what the person actually
// sees on their phone, not a UTC cutoff.
function toLocalDateString(isoString) {
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateString, delta) {
  const d = new Date(dateString + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// progress: { [dayNum]: { p, r, m, at } } as returned by /api/progress
export function computeStreak(progress) {
  const completedDates = new Set();
  for (const entry of Object.values(progress)) {
    if (entry.p && entry.r && entry.m && entry.at) {
      completedDates.add(toLocalDateString(entry.at));
    }
  }

  if (completedDates.size === 0) return 0;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  let cursor = `${year}-${month}-${day}`; // today, local time

  // If today has no completion yet, start counting from yesterday instead —
  // otherwise a streak would incorrectly reset to 0 first thing each morning
  // before that day's reading is done.
  if (!completedDates.has(cursor)) {
    cursor = addDays(cursor, -1);
  }

  let streak = 0;
  while (completedDates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
