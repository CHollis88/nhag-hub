import { NextResponse } from "next/server";

// Shared cache-header helpers for API routes.
//
// IMPORTANT DISTINCTION: `private` vs `public`.
// Most of this app's data endpoints check getCurrentUser() and return
// content shaped by *who's asking* (my_rsvp, i_volunteered, is_mine,
// unread counts, etc.), even when the underlying rows are shared. That
// makes the HTTP response personalized, not just "the same JSON for
// everyone" -- so it must be marked `private`. `private` still lets the
// requester's own browser cache it (which is all we want -- faster
// repeat loads on that one device), but tells any shared cache in
// between (a CDN edge, a corporate proxy) that it must NOT reuse this
// response for a different user. `public` would incorrectly say the
// opposite and risk one member's RSVP status being served to another
// member from a shared cache.
//
// Only genuinely static, unauthenticated content -- the Bible text
// endpoints (passage/commentary/lexicon/crossrefs/dictionary/glossary/
// beliefs/browse/word-lookup/chapter-counts) -- is safe to mark `public`,
// since those routes take no user into account and return the same
// bytes for anyone who asks.

/**
 * For data that's personalized per-request-er (events, news, prayer, etc).
 *
 * CAUTION -- not currently used anywhere in this app (as of the pass
 * that removed it everywhere): every one of these routes turned out to
 * have a corresponding write action the SAME screen calls and then
 * immediately re-fetches from (approve a join request and the roster
 * doesn't update, promote someone to admin and the button doesn't
 * change, highlight a verse and it's not there until a hard refresh --
 * all the same bug, just in different places). The browser's own HTTP
 * cache was serving the pre-write response back for up to maxAge
 * seconds, so the person had to force a hard reload to see their own
 * change take effect. Before reaching for this again, make sure
 * nothing on the calling screen writes to the same data and expects to
 * see its own write reflected without a manual refresh -- if it does,
 * use withNoStore below instead.
 */
export function withPrivateCache(json, { maxAge = 60, staleWhileRevalidate = 300 } = {}) {
  const res = NextResponse.json(json);
  res.headers.set("Cache-Control", `private, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
  return res;
}

/** For genuinely static, unauthenticated content (Bible text/reference data). */
export function withPublicCache(json, { maxAge = 3600, staleWhileRevalidate = 86400 } = {}) {
  const res = NextResponse.json(json);
  res.headers.set("Cache-Control", `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
  return res;
}

/** For anything that must always be fresh -- notifications, unread counts. */
export function withNoStore(json, init) {
  const res = NextResponse.json(json, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
