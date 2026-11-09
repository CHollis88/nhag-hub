// v71.25 -- "Add to calendar". Builds a standards-compliant .ics file in the
// browser (no server round trip, no database). Times are written as
// "floating" local time so the event shows at the same clock time wherever
// the phone is. An event without a time becomes an all-day event.

const pad = (n) => String(n).padStart(2, "0");

export function icsEscape(text) {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Lines longer than 75 octets must be folded (continuation lines start with a space).
export function foldLine(line) {
  if (line.length <= 73) return line;
  const out = [];
  let rest = line;
  out.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 72) { out.push(" " + rest.slice(0, 72)); rest = rest.slice(72); }
  if (rest) out.push(" " + rest);
  return out.join("\r\n");
}

const ymd = (s) => String(s).replaceAll("-", "");
const addDays = (s, n) => {
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}`;
};

// event: { id, title, event_date "YYYY-MM-DD", event_time "HH:MM"|null, location, notes }
export function buildIcs(event, { now = new Date(), durationMinutes = 60 } = {}) {
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NHAG Church Hub//Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id || ymd(event.event_date) + "-" + icsEscape(event.title)}@nhag-hub`,
    `DTSTAMP:${stamp}`,
  ];
  if (event.event_time) {
    const [h, m] = String(event.event_time).split(":").map(Number);
    const start = h * 60 + (m || 0);
    const end = start + durationMinutes;
    // Past midnight rolls to the next day.
    const endDay = end >= 1440 ? addDays(event.event_date, 1) : ymd(event.event_date);
    const e = end % 1440;
    lines.push(`DTSTART:${ymd(event.event_date)}T${pad(h)}${pad(m || 0)}00`);
    lines.push(`DTEND:${endDay}T${pad(Math.floor(e / 60))}${pad(e % 60)}00`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${ymd(event.event_date)}`);
    lines.push(`DTEND;VALUE=DATE:${addDays(event.event_date, 1)}`);
  }
  lines.push(`SUMMARY:${icsEscape(event.title)}`);
  if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
  if (event.notes) lines.push(`DESCRIPTION:${icsEscape(event.notes)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// Hands the file to the phone/computer (iOS offers "Add to Calendar").
export function downloadIcs(event) {
  const blob = new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = String(event.title || "event").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) || "event";
  a.href = url;
  a.download = `${safe}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
