import { requestJson } from "@/lib/request";
import { STALE, prefetchTogether } from "@/lib/resourceCache";

// Opening a ministry loads all of its main tabs in ONE request
// (/api/groups/:id/bundle) and drops each tab's data into the same cache
// entry that tab reads -- so tapping News, Events, Prayer, Roster, Songs,
// Setlists or Programs shows its content instantly.
//
// The keys and shapes here MUST match what each tab's useResource uses:
//   GroupNewsTab   group:<id>:news:published      -> .news
//   GroupEventsTab group:<id>:events              -> .events
//   GroupPrayerTab group:<id>:prayer              -> .prayer
//   RosterTab      group:<id>:members             -> whole response
//
// The song library is deliberately NOT included: it's the one big list
// (300+ songs, ~200 KB), so it still loads only when Songs or Setlists is
// opened. Everything included is a few KB, so loading it up front costs next
// to nothing even when only one tab gets looked at.
//   SetlistsTab    group:<id>:/api/groups/<id>/setlists  -> .setlists
//   ProgramsTab    group:<id>:programs            -> .programs
export function groupBundleSpecs(groupId, features = []) {
  const has = (f) => features.includes(f);
  const setlistsUrl = `/api/groups/${groupId}/setlists`;
  const specs = [
    { part: "news", key: `group:${groupId}:news:published`, staleMs: STALE.list, pick: (b) => b?.news?.news },
    { part: "events", key: `group:${groupId}:events`, staleMs: STALE.list, pick: (b) => b?.events?.events },
    { part: "members", key: `group:${groupId}:members`, staleMs: STALE.live, pick: (b) => b?.members },
  ];
  if (has("prayer")) {
    specs.push({ part: "prayer", key: `group:${groupId}:prayer`, staleMs: STALE.list, pick: (b) => b?.prayer?.prayer });
  }
  if (has("songs_setlists")) {
    specs.push({ part: "setlists", key: `group:${groupId}:${setlistsUrl}`, staleMs: STALE.list, pick: (b) => b?.setlists?.setlists });
  }
  if (has("programs")) {
    specs.push({ part: "programs", key: `group:${groupId}:programs`, staleMs: STALE.list, pick: (b) => b?.programs?.programs });
  }
  return specs;
}

// Loads whatever of this ministry isn't already fresh (or everything, with
// force -- the Refresh button). Makes no request at all if it's all fresh.
export function prefetchGroup(groupId, features, { force = false } = {}) {
  const specs = groupBundleSpecs(groupId, features);
  return prefetchTogether(
    specs,
    (needed) =>
      requestJson(`/api/groups/${groupId}/bundle?parts=${needed.map((s) => s.part).join(",")}`, { cache: "no-store" }),
    { force }
  );
}
