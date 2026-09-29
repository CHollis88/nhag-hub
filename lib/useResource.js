"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { STALE, peek, subscribe, registerActive, fetchResource, mutateResource, startRefreshCoordinator } from "@/lib/resourceCache";

// v71 #42-45 -- read a piece of server data through the shared cache.
//
//   const { data, loading, error, refreshing, refresh, setData } =
//     useResource("sermons", () => requestJson("/api/sermons"), { staleMs: STALE.list });
//
//   data        the cached (or freshly fetched) value, or null before the first load
//   loading     true ONLY on the very first load, when there is nothing to show yet
//               -- this is the only time a screen should draw a skeleton
//   error       the failure, but only when there is no data to show instead;
//               a failed BACKGROUND refresh keeps showing the old data (refreshError)
//   refreshing  a quiet background refresh is running (show nothing, or a subtle hint)
//   refresh()   fetch again now (a "Try again" button, or after a change you made)
//   setData(fn) optimistic edit of the cached value
//
// Coming back to a screen shows what was cached INSTANTLY; if it has gone stale
// (see STALE) it is refreshed quietly behind it. Two screens asking for the same
// key make one request. A `key` of null (or enabled: false) does nothing.
// Keys are scoped to the signed-in user inside the cache -- never put a user id
// in a key yourself.
export function useResource(key, fetcher, { staleMs = STALE.list, enabled = true } = {}) {
  const [, rerender] = useReducer((n) => n + 1, 0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const active = Boolean(key) && enabled;

  const load = useCallback(
    ({ force = false } = {}) => fetchResource(key, () => fetcherRef.current(), { staleMs, force }),
    [key, staleMs]
  );

  useEffect(() => {
    startRefreshCoordinator(); // idempotent: one coordinator for the whole app
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const unsubscribe = subscribe(key, rerender);
    const unregister = registerActive(key, { revalidate: (opts) => load(opts).catch(() => {}) });
    load().catch(() => {}); // shows cached data now; fetches only if missing or stale
    return () => {
      unsubscribe();
      unregister();
    };
  }, [active, key, load]);

  const refresh = useCallback(() => load({ force: true }), [load]);
  const setData = useCallback((updater) => mutateResource(key, updater), [key]);

  const entry = active ? peek(key) : null;
  const hasData = Boolean(entry) && entry.data !== null && entry.data !== undefined;
  return {
    data: hasData ? entry.data : null,
    // Skeleton only when there is truly nothing to show and nothing has failed.
    loading: active && !hasData && !entry?.error,
    error: active && !hasData ? entry?.error || null : null,
    refreshing: hasData && Boolean(entry.promise),
    refreshError: hasData ? entry.error || null : null,
    refresh,
    setData,
  };
}
