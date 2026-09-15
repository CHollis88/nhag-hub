const KEY = "sp_last_seen";

function getAll() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function getLastSeen(tab) {
  return getAll()[tab] || null;
}

export function markSeen(tab) {
  if (typeof window === "undefined") return;
  const all = getAll();
  all[tab] = new Date().toISOString();
  localStorage.setItem(KEY, JSON.stringify(all));
}

// True if the latest content for this tab is newer than the last time
// the person actually opened it -- the first time ever (no last-seen
// recorded yet) does NOT count as "new," since everything is
// technically new to a brand-new user and a dot on every tab on first
// login would be noise, not a signal.
export function hasNewContent(tab, latestTimestamp) {
  if (!latestTimestamp) return false;
  const lastSeen = getLastSeen(tab);
  if (!lastSeen) return false;
  return new Date(latestTimestamp) > new Date(lastSeen);
}
