import crypto from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";

export const SESSION_COOKIE_NAME = "hub_session";

// Sessions never expire on their own (per spec: "logged in forever, multi
// device"). The cookie itself still needs a max-age or browsers will treat
// it as a session-only cookie and drop it on browser close, so we set a
// very long cookie lifetime — this is a browser-storage detail, not an
// actual expiry of the underlying `sessions` row. The row is what matters;
// it lives until explicitly revoked (sign-out, or admin recovery action).
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5; // 5 years

function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

// Creates a new session row for this user and returns the raw token to set
// as a cookie. One row per device/browser — does not touch any other
// existing sessions for this user.
export async function createSession(userId) {
  const supabase = supabaseServer();
  const token = randomToken();

  const { error } = await supabase.from("sessions").insert({
    user_id: userId,
    token,
  });

  if (error) throw new Error(error.message);
  return token;
}

// ---------------------------------------------------------------------------
// Short in-memory session cache (v71 #1)
// ---------------------------------------------------------------------------
// Every authenticated API call used to cost one Supabase request just to
// resolve the cookie to a user (`GET sessions` was the #1 path in the
// request logs), and most group routes then paid a second request to
// check membership. Now the session lookup also carries the user's active
// memberships, and the result is kept per server instance for a short
// time.
//
// Staleness is bounded to SESSION_CACHE_TTL_MS. Changes made through THIS
// instance clear the affected entries right away (sign-out, PIN change,
// admin/role change, membership changes, profile edits -- see
// invalidateSessionToken / invalidateUserSessions). Other instances catch
// up when their entry expires.
//
// Users who haven't finished signup (no username yet) are never cached:
// complete-signup changes that on a possibly different instance, and a
// stale "incomplete" user would bounce them back to the setup screen.
const SESSION_CACHE_TTL_MS = 30 * 1000;
const SESSION_CACHE_MAX = 500;
const sessionCache = new Map(); // token -> { user, expires }

function cacheGet(token) {
  const hit = sessionCache.get(token);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    sessionCache.delete(token);
    return null;
  }
  // Refresh recency for LRU eviction (Map keeps insertion order).
  sessionCache.delete(token);
  sessionCache.set(token, hit);
  return hit.user;
}

function cacheSet(token, user) {
  sessionCache.set(token, { user, expires: Date.now() + SESSION_CACHE_TTL_MS });
  while (sessionCache.size > SESSION_CACHE_MAX) {
    sessionCache.delete(sessionCache.keys().next().value);
  }
}

export function invalidateSessionToken(token) {
  if (token) sessionCache.delete(token);
}

// Clears every cached session belonging to this user on this instance --
// used after anything that changes who they are or what they can reach
// (role, admin flag, memberships, profile, PIN, revoked sessions).
export function invalidateUserSessions(userId) {
  if (!userId) return;
  for (const [token, entry] of sessionCache) {
    if (entry.user?.id === userId) sessionCache.delete(token);
  }
}

// Group-wide changes (hiding a ministry, deleting one) affect every
// member's cached memberships at once; clear this instance's cache.
export function clearSessionCache() {
  sessionCache.clear();
  legacyUntil = 0; // re-probe for the migration_035 columns on the next lookup
}

// Only refresh last_seen_at when it's older than this. It was being
// written on EVERY authenticated request -- one extra Supabase call per
// API hit, and a big share of this project's log volume -- for a value
// nothing in the app reads at finer than "recently" granularity.
const LAST_SEEN_REFRESH_MS = 15 * 60 * 1000;

// --- pre-migration_035 compatibility ---------------------------------------
const SESSION_SELECT =
  "id, last_seen_at, admin_mode, pin_verified_at, " +
  "user:users(id, email, username, display_name, bio, is_church_admin, admin_notifications_enabled, active_reading_plan, " +
  "memberships:group_members(group_id, role, status, groups(hidden, hide_restricts_access, archived_at)))";
const SESSION_SELECT_LEGACY =
  "id, last_seen_at, " +
  "user:users(id, email, username, display_name, bio, is_church_admin, active_reading_plan, " +
  "memberships:group_members(group_id, role, status, groups(hidden, hide_restricts_access)))";
const LEGACY_RETRY_MS = 30 * 1000; // re-check for the new columns every 30 s
let legacyUntil = 0;

function isMissingColumn(error) {
  return error?.code === "42703" || /column .* does not exist|could not find .* column/i.test(error?.message || "");
}

function runSessionQuery(supabase, token) {
  const columns = Date.now() < legacyUntil ? SESSION_SELECT_LEGACY : SESSION_SELECT;
  return supabase.from("sessions").select(columns).eq("token", token).maybeSingle();
}

// Looks up the session by token and returns the associated user row --
// plus `memberships`, the user's ACTIVE group_members rows (group_id,
// role, and the group's hidden/hide_restricts_access flags) -- or null if
// the token doesn't match an active session. lib/groupAuth.js reads
// `memberships` so group routes don't each query group_members again.
export async function getUserForSessionToken(token) {
  if (!token) return null;

  const cached = cacheGet(token);
  if (cached) return cached;

  const supabase = supabaseServer();
  // Session, user, and the user's memberships in ONE request (embedded
  // via sessions.user_id -> users.id and group_members.user_id -> users.id).
  let { data: session, error } = await runSessionQuery(supabase, token);
  if (error && isMissingColumn(error)) {
    // migration_035 hasn't been run yet. Don't take the whole app down
    // (every request would fail and everyone would look signed out): fall
    // back to the pre-v71 query. Admin mode is then simply "on" for
    // everyone and nothing can be archived, i.e. exactly v70.2 behavior.
    legacyUntil = Date.now() + LEGACY_RETRY_MS;
    ({ data: session, error } = await runSessionQuery(supabase, token));
  }

  if (error || !session || !session.user) return null;

  const lastSeen = session.last_seen_at ? new Date(session.last_seen_at).getTime() : 0;
  if (Date.now() - lastSeen > LAST_SEEN_REFRESH_MS) {
    supabase
      .from("sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", session.id)
      .then(() => {})
      .catch(() => {});
  }

  // v71 #19: "Use Admin Privileges". The ROLE (users.is_church_admin) is
  // never changed by the switch; the SESSION decides whether this device is
  // currently allowed to act on it. `is_church_admin` below is the EFFECTIVE
  // value (role AND this session's switch is on) -- every server check that
  // reads user.is_church_admin therefore treats a session with privileges
  // off as a regular member, with no per-route changes. `has_admin_role` is
  // the underlying role, for the Settings switch itself and for anything
  // that must still work while privileges are off (turning them back on).
  const hasAdminRole = Boolean(session.user.is_church_admin);
  const adminMode = session.admin_mode !== false; // missing column (pre-035) = on
  const user = {
    ...session.user,
    is_church_admin: hasAdminRole && adminMode,
    has_admin_role: hasAdminRole,
    admin_mode: adminMode,
    // v71: false = this admin has turned OFF the admin-duty notifications.
    admin_notifications_enabled: session.user.admin_notifications_enabled !== false,
    // When this session last re-entered its PIN (see lib/adminAuth.js).
    pin_verified_at: session.pin_verified_at || null,
    memberships: (session.user.memberships || [])
      .filter((m) => m.status === "active")
      .map((m) => ({
        group_id: m.group_id,
        role: m.role,
        hidden: Boolean(m.groups?.hidden),
        hide_restricts_access: Boolean(m.groups?.hide_restricts_access),
        archived: Boolean(m.groups?.archived_at),
      })),
  };

  // Sessions of anyone who HOLDS the admin role are deliberately not cached
  // (v71 #19/#21). The cache is per server instance, so a cached copy on
  // another instance could keep acting as an admin for up to 30 s after
  // "Use Admin Privileges" was turned off, or keep honoring a PIN stamp.
  // Admins are a couple of people, so skipping the cache for them costs
  // almost nothing and makes "off" immediate everywhere.
  if (user.username && !user.has_admin_role) cacheSet(token, user);
  return user;
}

export async function deleteSessionByToken(token) {
  if (!token) return;
  invalidateSessionToken(token);
  const supabase = supabaseServer();
  await supabase.from("sessions").delete().eq("token", token);
}

// Admin recovery action: sign a user out on every device at once.
export async function deleteAllSessionsForUser(userId) {
  invalidateUserSessions(userId);
  const supabase = supabaseServer();
  const { error } = await supabase.from("sessions").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}
