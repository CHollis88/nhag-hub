import { requestJson } from "@/lib/request";

// Notifications clear themselves when you open what they're about (v71.29).
// Screens call markNotificationsReadFor("/?group=<id>&tab=news") when shown.
// No request at all unless you actually have unread notifications, and the
// same screen isn't re-sent within a minute.
let unread = null; // not known yet (the app is still starting)
const waiting = new Set(); // screens opened before the count was known
const listeners = new Set();
const recent = new Map(); // prefix -> time sent

export function setUnreadForAutoRead(n) {
  if (typeof n !== "number") return;
  const first = unread === null;
  if (!first && n > unread) recent.clear(); // something new arrived: screens may clear again
  unread = n;
  if (first && waiting.size) {
    const queued = [...waiting];
    waiting.clear();
    markNotificationsReadFor(...queued);
  }
}

export function onUnreadChanged(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function markNotificationsReadFor(...prefixes) {
  if (unread === null) {
    // e.g. opened straight from a notification: wait until the count arrives.
    prefixes.forEach((p) => p && waiting.add(p));
    return;
  }
  if (unread <= 0) return;
  const now = Date.now();
  const fresh = prefixes.filter((p) => p && now - (recent.get(p) || 0) > 60000);
  if (!fresh.length) return;
  fresh.forEach((p) => recent.set(p, now));
  try {
    const data = await requestJson("/api/notifications/mark-read-for", { method: "POST", body: { prefixes: fresh } });
    if (typeof data.unread_count === "number" && data.unread_count !== unread) {
      unread = data.unread_count;
      listeners.forEach((fn) => fn(unread));
    }
  } catch {
    fresh.forEach((p) => recent.delete(p)); // try again next time
  }
}
