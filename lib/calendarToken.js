import crypto from "node:crypto";

// v71.25 -- the private link a phone uses to subscribe to the calendar.
// Phones can't sign in, so the link itself is the key: "<userId>.<signature>",
// where the signature can only be made by this server. No database column is
// needed. The link shows only what that person can already see in the app.
// To invalidate EVERY link at once (if one leaks), change CALENDAR_LINK_SALT
// in Vercel -- or just tell me and I'll add per-person reset.
function secret() {
  return `${process.env.CALENDAR_LINK_SALT || ""}|${process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ""}`;
}
const sign = (userId) => crypto.createHmac("sha256", secret()).update(`calendar:${userId}`).digest("base64url").slice(0, 32);

export function makeCalendarToken(userId) {
  return `${userId}.${sign(userId)}`;
}

// Returns the user id, or null if the token isn't genuine.
export function readCalendarToken(token) {
  const i = String(token || "").lastIndexOf(".");
  if (i < 1) return null;
  const userId = token.slice(0, i);
  const given = token.slice(i + 1);
  const expected = sign(userId);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return userId;
}
