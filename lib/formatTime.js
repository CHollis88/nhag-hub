// Converts a 24-hour "HH:MM" string (what <input type="time"> always
// stores, regardless of locale) into a readable 12-hour "H:MM AM/PM"
// string. Tested against midnight, noon, and standard AM/PM cases.
export function formatTime12h(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}
