// v71 #44 -- paging for lists that grow without end (chat messages, direct
// messages, notifications). Before this, opening a chat downloaded EVERY
// message ever sent -- and the app re-downloaded them all every 10 seconds
// while a chat was open.
//
// The contract: the newest `limit` items come back (default 50, at most 100),
// plus `has_more` saying whether older ones exist. `before=<created_at>` asks
// for the page of items OLDER than that timestamp. Ask the database for
// limit + 1 rows: the extra row is how we know there is more, and is dropped.
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

// Returns { limit, before } or { error } for a bad `before`.
export function pageParams(searchParams, { defaultLimit = DEFAULT_PAGE_SIZE } = {}) {
  const rawLimit = Number.parseInt(searchParams.get("limit") || "", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_PAGE_SIZE) : defaultLimit;

  const rawBefore = searchParams.get("before");
  if (rawBefore === null || rawBefore === "") return { limit, before: null };
  if (Number.isNaN(Date.parse(rawBefore))) return { error: "before must be a timestamp." };
  return { limit, before: rawBefore };
}

// `rows` are newest-first with up to limit + 1 entries.
// Returns { rows: newest-first, at most `limit`, hasMore }.
export function trimPage(rows, limit) {
  const list = rows || [];
  return { rows: list.slice(0, limit), hasMore: list.length > limit };
}
