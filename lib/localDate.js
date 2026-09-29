// v71 #3 -- "today" in the USER's timezone.
//
// `new Date().toISOString().slice(0, 10)` is the UTC date, which flips to
// tomorrow at 7 pm Central (6 pm in winter), so an event tonight counted
// as "past" and the reading streak rolled over hours early. These helpers
// build the local calendar date instead.

const pad = (n) => String(n).padStart(2, "0");

// Local Y-M-D for a Date (default: now), in the browser's timezone.
export function todayLocal(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Local Y-M-D for `daysAgo` days before `base` (a Y-M-D string).
// Pure calendar arithmetic (done in UTC so DST shifts can't skip a day).
export function shiftDate(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

// The client's UTC offset in minutes, in Date#getTimezoneOffset's sign
// (e.g. 300 for CDT). Sent to server routes that must bucket UTC
// timestamps into the user's local days.
export function tzOffsetMinutes() {
  return new Date().getTimezoneOffset();
}

// SERVER SIDE: the local Y-M-D that a UTC timestamp falls on for a client
// with the given getTimezoneOffset() value.
export function localDateOfTimestamp(iso, offsetMinutes) {
  const t = new Date(new Date(iso).getTime() - offsetMinutes * 60 * 1000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
