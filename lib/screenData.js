import { requestJson } from "@/lib/request";
import { STALE, fetchResource } from "@/lib/resourceCache";
import { ADMIN_ATTENTION, ADMIN_USERS } from "@/lib/adminData";
import { HOME_GROUPS } from "@/lib/homeData";

// What some header screens load, in one place, so a button can start the
// load the moment it's pressed (see HeaderButton's onPress) and the screen
// reads the very same cache entry when it opens. Nothing here is loaded
// unless someone is actually opening that screen -- no extra requests.
export const SETTINGS_PREFS = {
  key: "settings:notification-prefs",
  fetcher: () => requestJson("/api/notifications/preferences"),
  staleMs: STALE.list,
};

export const NOTIFICATIONS_FIRST_PAGE = {
  key: "notifications:first-page",
  fetcher: () => requestJson("/api/notifications"),
  staleMs: STALE.live,
};

const warm = (...resources) =>
  resources.forEach((r) => fetchResource(r.key, r.fetcher, { staleMs: r.staleMs }).catch(() => {}));

export const warmSettings = () => warm(SETTINGS_PREFS);
export const warmNotifications = () => warm(NOTIFICATIONS_FIRST_PAGE);
export const warmAdminToolbox = () => warm(ADMIN_ATTENTION, ADMIN_USERS, HOME_GROUPS);

// Tabs: warmed when a finger touches the tab in the bottom bar. Keys and
// shapes match EventsTab ("events:church") and SermonsTab's default view
// (published, all series) exactly, so the tab finds them already loaded.
const TAB_DATA = {
  events: [{ key: "events:church", fetcher: async () => (await requestJson("/api/global/events")).events, staleMs: STALE.list }],
  sermons: [
    { key: "sermons:published:all", fetcher: async () => (await requestJson("/api/sermons")).sermons, staleMs: STALE.list },
    { key: "sermon-series", fetcher: async () => (await requestJson("/api/sermon-series")).series, staleMs: STALE.list },
  ],
  news: [],
};
export const warmTab = (tab) => warm(...(TAB_DATA[tab] || []));
