import { requestJson } from "@/lib/request";
import { STALE } from "@/lib/resourceCache";

// Admin Toolbox data in the shared screen cache, so reopening the Toolbox
// shows everything at once. Short freshness: admins act on these.
export const ADMIN_ATTENTION = {
  key: "admin:needs-attention",
  fetcher: () => requestJson("/api/admin/needs-attention"),
  staleMs: STALE.live,
};

export const ADMIN_USERS = {
  key: "admin:users",
  fetcher: async () => (await requestJson("/api/admin/users")).users,
  staleMs: STALE.live,
};
