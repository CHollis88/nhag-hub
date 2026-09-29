// v71 #44 -- how a chat screen combines pages of messages.
//
// The screen shows some OLDER messages the person chose to load, plus the newest
// page that polling refreshes every few seconds. Polling only ever fetches the
// newest page, so it must be merged onto what's already there, not replace it
// (that would throw away the older messages they just scrolled up to read).
//
// Lists are oldest -> newest and each message has an `id` and a `created_at`.

// A fresh copy of the newest page arrived. Everything at or after its first
// message is replaced by it (so edits, deletions and new reactions inside that
// window show up); anything OLDER that was already loaded is kept.
export function mergeLatest(current, latest) {
  if (!current) return latest;
  if (!latest.length) return []; // the chat has been emptied
  const cutoff = latest[0].created_at;
  return [...current.filter((m) => m.created_at < cutoff), ...latest];
}

// An older page arrived: put it before what's shown, skipping any message that is
// already there (a message posted while paging can shift a page boundary).
export function prependOlder(current, older) {
  const have = new Set((current || []).map((m) => m.id));
  return [...older.filter((m) => !have.has(m.id)), ...(current || [])];
}
