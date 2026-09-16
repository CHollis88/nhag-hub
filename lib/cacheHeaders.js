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

/** For data that's personalized per-request-er (events, news, prayer, etc). */
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
