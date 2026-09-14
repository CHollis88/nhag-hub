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
export async function getUserForSessionToken(token) {
  if (!token) return null;

  const supabase = supabaseServer();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, user_id")
    .eq("token", token)
    .maybeSingle();

  if (error || !session) return null;

  supabase
    .from("sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", session.id)
    .then(() => {})
    .catch(() => {});

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, email, username, display_name, is_church_admin, active_reading_plan")
    .eq("id", session.user_id)
    .maybeSingle();

  if (userError || !user) return null;
  return user;
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
