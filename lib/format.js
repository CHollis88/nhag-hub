export function fmtEventDate(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// Converts a 24-hour "HH:MM" string (from <input type="time">) into a
// friendly 12-hour display like "2:00 PM", instead of showing "14:00".
export function fmtEventTime(t) {
  if (!t) return "";
  const [hourStr, minute] = t.split(":");
  let hour = parseInt(hourStr, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${suffix}`;
}

// A post's timestamp for news cards: "Sep 30 · 11:42 AM". The year is added
// only when it isn't this year ("Dec 14, 2025 · 7:05 PM").
export function fmtPostDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}
