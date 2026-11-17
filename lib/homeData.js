import { requestJson } from "@/lib/request";
import { STALE } from "@/lib/resourceCache";

// The data the Home screen shows, in ONE place, so the welcome screen can
// start loading it while the app boots and Home reads the very same cache
// entries -- Home is already filled in when the welcome screen lifts.
export const HOME_GROUPS = {
  key: "home:groups",
  fetcher: async () => {
    const data = await requestJson("/api/groups", { cache: "no-store" });
    return Array.isArray(data.groups) ? data.groups : [];
  },
  staleMs: STALE.list,
};

export const HOME_EVENTS = {
  key: "home:events-mine",
  fetcher: () => requestJson("/api/events/mine"),
  staleMs: STALE.list,
};

// Same key the News tab uses for its list, so the two share one copy.
export const HOME_NEWS = {
  key: "news:church:published",
  fetcher: async () => (await requestJson("/api/global/news")).news,
  staleMs: STALE.list,
};

export const HOME_RESOURCES = [HOME_GROUPS, HOME_EVENTS, HOME_NEWS];
