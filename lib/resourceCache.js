// v71 #42-45 -- the one client-side request cache.
//
// Screens used to fetch again from scratch every time you came back to them
// (switch to Songs, then Setlists, then Songs again: three loads, two of them
// blank skeletons for data you had 5 seconds ago). This store lets a screen show
// what it already has INSTANTLY and refresh it quietly behind the scenes.
//
//   * cache by key, with the time it was fetched;
//   * in-flight de-duplication: two screens asking for the same thing at once
//     make ONE request;
//   * stale times by kind of data (see STALE): a sermon list is good for minutes,
//     a message list for seconds;
//   * targeted invalidation after a change: invalidate("sermons") marks every
//     sermon entry stale and refreshes the ones on screen;
//   * PRIVATE by construction: every key is scoped to the signed-in user, and
//     the whole cache is emptied at sign-out or when a different person signs
//     in, so one person's data can never show up for another on a shared device.
//
// This file is plain JavaScript with no React, so its rules can be tested exactly.
// The React side is lib/useResource.js.

// How long data counts as fresh, by kind. After this, the cached copy is still
// SHOWN immediately, but a quiet refresh is started.
export const STALE = {
  static: 24 * 60 * 60 * 1000, // things that essentially never change
  list: 2 * 60 * 1000, // sermons, songs, rosters, news, events: minutes
  live: 15 * 1000, // messages, join requests, notifications: seconds
  user: 30 * 1000, // current user and roles (also invalidated when they change)
};

const entries = new Map(); // scopedKey -> { data, at, staleMs, promise, error }
const listeners = new Map(); // scopedKey -> Set<fn>
const mounted = new Map(); // scopedKey -> Set<subscriber>  (views on screen right now)
let currentUser = null;

const scope = (key) => `${currentUser ?? "anon"}::${key}`;
const unscope = (scoped) => scoped.slice(scoped.indexOf("::") + 2);

function notify(scoped) {
  for (const fn of listeners.get(scoped) || []) fn();
}

// Who the cache belongs to. A different user (or null at sign-out) empties it.
export function setCacheUser(userId) {
  const next = userId ?? null;
  if (next === currentUser) return;
  clearResourceCache();
  currentUser = next;
}

// v71 #43 -- what you were doing on a screen (the search you typed, the filter
// you picked, how far you'd scrolled) is remembered here so it is still there
// when you come back to the screen. Same privacy rule as the data: cleared at
// sign-out and whenever a different person signs in.
const screenStore = new Map();
export function readScreenState(key, fallback) {
  return screenStore.has(key) ? screenStore.get(key) : fallback;
}
export function writeScreenState(key, value) {
  screenStore.set(key, value);
}

// Empties EVERYTHING. Called at sign-out, when a different person signs in,
// and when the same person's privileges change.
//
// `refetchMounted`: also reload whatever is on screen right now. Without it a
// screen that stays open has nothing to show and nothing telling it to fetch
// again (it only fetches when it first appears). Use it when the SAME person
// carries on using the app (privileges changed); not for sign-out or a change
// of person, where the screens are about to go away.
export function clearResourceCache({ refetchMounted = false } = {}) {
  screenStore.clear();
  const keys = [...entries.keys()];
  entries.clear();
  for (const scoped of keys) {
    notify(scoped);
    if (refetchMounted) for (const sub of mounted.get(scoped) || []) sub.revalidate({ force: true });
  }
}

export function peek(key) {
  return entries.get(scope(key)) || null;
}

export function isFresh(key, staleMs, now = Date.now()) {
  const entry = peek(key);
  if (!entry || entry.at == null) return false;
  return now - entry.at < (staleMs ?? entry.staleMs ?? STALE.list);
}

// Fetches `key` with `fetcher`, sharing any request already in flight for it
// (in-flight requests are ALWAYS shared). Resolves with the data; rejects if the
// request fails, in which case the previous data, if any, is kept. Fresh data is
// returned without a request unless `force` skips that freshness check.
export function fetchResource(key, fetcher, { staleMs = STALE.list, force = false } = {}) {
  const scoped = scope(key);
  const existing = entries.get(scoped);

  if (existing?.promise) return existing.promise; // de-duplicate
  if (!force && existing && existing.at != null && Date.now() - existing.at < staleMs) {
    return Promise.resolve(existing.data);
  }

  const entry = existing || { data: null, at: null, staleMs, promise: null, error: null };
  entry.staleMs = staleMs;
  entries.set(scoped, entry);

  const promise = Promise.resolve()
    .then(fetcher)
    .then(
      (data) => {
        // This entry was cleared or forgotten while the request was in flight
        // (signed out, a different person signed in, access lost): the answer
        // belongs to nobody now. Drop it rather than write it into a cache that
        // no longer has this entry. (Checked per ENTRY, so an unrelated request
        // that happens to be in flight is never affected.)
        if (entries.get(scoped) !== entry) return data;
        entry.data = data;
        entry.at = Date.now();
        entry.error = null;
        entry.promise = null;
        notify(scoped);
        return data;
      },
      (error) => {
        if (entries.get(scoped) === entry) {
          entry.promise = null;
          entry.error = error;
          notify(scoped);
        }
        throw error;
      }
    );
  entry.promise = promise;
  // Tell screens a fetch has STARTED, not only when it ends -- that's how a
  // screen learns to show "refreshing" (or to leave the blank state for loading).
  notify(scoped);
  // A failed background refresh must not become an unhandled rejection; callers that care await the promise.
  promise.catch(() => {});
  return promise;
}

// Optimistic local edit: `updater` gets the current data and returns the new data.
export function mutateResource(key, updater) {
  const scoped = scope(key);
  const entry = entries.get(scoped);
  if (!entry) return;
  entry.data = typeof updater === "function" ? updater(entry.data) : updater;
  notify(scoped);
}

// After a change: mark matching entries stale (so the next visit refetches) and
// refresh the ones that are on screen right now. `match` is an exact key, a key
// prefix ending in "*" ("sermons*"), or a predicate.
export function invalidate(match) {
  const test =
    typeof match === "function"
      ? match
      : match.endsWith("*")
        ? (k) => k.startsWith(match.slice(0, -1))
        : (k) => k === match;
  for (const [scoped, entry] of entries) {
    if (!scoped.startsWith(`${currentUser ?? "anon"}::`)) continue;
    if (!test(unscope(scoped))) continue;
    entry.at = null; // stale from now on
    notify(scoped);
    for (const sub of mounted.get(scoped) || []) sub.revalidate({ force: true });
  }
}

// Deletes matching entries outright (unlike invalidate, which keeps the old data
// to show while refreshing). For when you must NOT keep showing it: you lost
// access to a ministry, or your privileges changed. Same match forms as invalidate.
export function forget(match) {
  const test =
    typeof match === "function"
      ? match
      : match.endsWith("*")
        ? (k) => k.startsWith(match.slice(0, -1))
        : (k) => k === match;
  for (const scoped of [...entries.keys()]) {
    if (!scoped.startsWith(`${currentUser ?? "anon"}::`)) continue;
    if (!test(unscope(scoped))) continue;
    entries.delete(scoped); // a request still in flight for it will see it's gone and drop its answer
    notify(scoped);
    // A screen still showing it gets a fresh load instead of a permanent blank.
    for (const sub of mounted.get(scoped) || []) sub.revalidate({ force: true });
  }
}

export function subscribe(key, fn) {
  const scoped = scope(key);
  if (!listeners.has(scoped)) listeners.set(scoped, new Set());
  listeners.get(scoped).add(fn);
  return () => {
    listeners.get(scoped)?.delete(fn);
    if (!listeners.get(scoped)?.size) listeners.delete(scoped);
  };
}

// A view on screen registers here so the refresh coordinator (and invalidate)
// know what is ACTIVE. `sub.revalidate({force})` re-fetches it.
export function registerActive(key, sub) {
  const scoped = scope(key);
  if (!mounted.has(scoped)) mounted.set(scoped, new Set());
  mounted.get(scoped).add(sub);
  return () => {
    mounted.get(scoped)?.delete(sub);
    if (!mounted.get(scoped)?.size) mounted.delete(scoped);
  };
}

// One pass over what's on screen: refresh whatever has gone stale. Nothing off
// screen is touched. Returns how many refreshes were started.
export function revalidateStaleActive(now = Date.now()) {
  let started = 0;
  for (const [scoped, subs] of mounted) {
    if (!scoped.startsWith(`${currentUser ?? "anon"}::`)) continue;
    const entry = entries.get(scoped);
    const stale = !entry || entry.at == null || now - entry.at >= (entry.staleMs ?? STALE.list);
    if (!stale || entry?.promise) continue;
    for (const sub of subs) {
      sub.revalidate({ force: false });
      started += 1;
      break; // one refresh per key is enough; the others share the result
    }
  }
  return started;
}

// ---- refresh coordinator: ONE place decides when screens refresh on their own.
// Coming back to the tab, regaining focus, or the network returning triggers a
// pass -- but only for stale data on views that are on screen, and never more
// often than MIN_INTERVAL_MS. (Replaces each screen deciding for itself.)
export const MIN_INTERVAL_MS = 15 * 1000;
let lastPass = -Infinity;
let coordinatorStarted = false;

export function refreshPass({ reason = "focus", now = Date.now(), isVisible = true } = {}) {
  if (!isVisible) return 0;
  if (reason !== "online" && now - lastPass < MIN_INTERVAL_MS) return 0;
  lastPass = now;
  return revalidateStaleActive(now);
}

export function startRefreshCoordinator() {
  if (coordinatorStarted || typeof document === "undefined") return () => {};
  coordinatorStarted = true;
  const visible = () => document.visibilityState !== "hidden";
  const onVisibility = () => refreshPass({ reason: "visibility", isVisible: visible() });
  const onFocus = () => refreshPass({ reason: "focus", isVisible: visible() });
  const onOnline = () => refreshPass({ reason: "online", isVisible: visible() });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onFocus);
  window.addEventListener("online", onOnline);
  return () => {
    coordinatorStarted = false;
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("online", onOnline);
  };
}

// Test-only: forget the coordinator's rate-limit memory.
export function _resetCoordinatorForTests() {
  lastPass = -Infinity;
}
