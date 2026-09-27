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

// Looks up the session by token and returns the associated user row, or
// null if the token doesn't match an active session. Also bumps
// last_seen_at (fire-and-forget, not awaited, so it never slows down the
// request it's piggybacking on).
// Only refresh last_seen_at when it's older than this. It was being
// written on EVERY authenticated request -- one extra Supabase call per
// API hit, and a big share of this project's log volume -- for a value
// nothing in the app reads at finer than "recently" granularity.
const LAST_SEEN_REFRESH_MS = 15 * 60 * 1000;

export async function getUserForSessionToken(token) {
  if (!token) return null;

  const supabase = supabaseServer();
  // Session and user in ONE request (embedded via the
  // sessions.user_id -> users.id foreign key) instead of two.
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, last_seen_at, user:users(id, email, username, display_name, is_church_admin, active_reading_plan)")
    .eq("token", token)
    .maybeSingle();

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

  return session.user;
}

export async function deleteSessionByToken(token) {
  if (!token) return;
  const supabase = supabaseServer();
  await supabase.from("sessions").delete().eq("token", token);
}

// Admin recovery action: sign a user out on every device at once.
export async function deleteAllSessionsForUser(userId) {
  const supabase = supabaseServer();
  const { error } = await supabase.from("sessions").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}
