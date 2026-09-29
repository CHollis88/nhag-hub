import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { SESSION_COOKIE_NAME, invalidateSessionToken } from "@/lib/session";
import { verifyPin } from "@/lib/pin";

// v71 #20 / #21 -- PIN re-checks for the actions that can't be undone or
// that change who has power.
//
// A signed-in session is trusted for everyday things, but a few actions are
// worth asking "is this really you?" again, because a phone left unlocked
// or a stolen session shouldn't be enough:
//   * granting or removing someone's admin role
//   * permanently deleting a ministry
//   * signing another person out on every device
//   * turning Admin Privileges back ON
// Routine approvals deliberately do NOT ask.
//
// Re-entering the PIN (POST /api/auth/verify-pin) stamps THIS session with
// pin_verified_at; the gated routes then accept it for PIN_VERIFY_WINDOW_MS.
// Every attempt is counted in the database (users.pin_fail_count, see
// migration_035), so the PIN can't simply be guessed.

export const PIN_VERIFY_WINDOW_MS = 5 * 60 * 1000;
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;
const PIN_RE = /^\d{4,8}$/;

// Has this session re-entered its PIN in the last few minutes?
// (Computed from the timestamp each time, not when the cached user object
// was built, so a cached copy can't stretch the window.)
export function hasRecentPin(user, now = Date.now()) {
  if (!user?.pin_verified_at) return false;
  const at = new Date(user.pin_verified_at).getTime();
  return Number.isFinite(at) && now - at < PIN_VERIFY_WINDOW_MS && now >= at - 5000;
}

// null when the PIN was verified recently; otherwise the 403 the client
// recognises (code "pin_required") to show its PIN prompt and retry.
export function requireRecentPin(user) {
  if (hasRecentPin(user)) return null;
  return NextResponse.json({ error: "Enter your PIN to continue.", code: "pin_required" }, { status: 403 });
}

/**
 * Checks a PIN with attempt limiting.
 * @returns {{ status: "ok" } |
 *            { status: "wrong", attemptsLeft: number, lockedUntil: string|null } |
 *            { status: "locked", lockedUntil: string } |
 *            { status: "no_pin" } | { status: "invalid" } | { status: "unavailable", message: string }}
 */
export async function checkPin(userId, pin) {
  if (typeof pin !== "string" || !PIN_RE.test(pin)) return { status: "invalid" };

  const supabase = supabaseServer();

  // Counted BEFORE comparing, under a row lock, so parallel guesses can't
  // all slip through before the lockout lands.
  const { data: begin, error: beginError } = await supabase.rpc("pin_attempt_begin", {
    p_user_id: userId,
    p_max: PIN_MAX_ATTEMPTS,
    p_lock_minutes: PIN_LOCK_MINUTES,
    p_decay_minutes: 60,
  });
  if (beginError) {
    return { status: "unavailable", message: "PIN checks need a database update that hasn't been applied yet (v71 migration 035)." };
  }
  if (!begin?.allowed) return { status: "locked", lockedUntil: begin?.locked_until || null };

  const { data: row } = await supabase.from("users").select("pin_hash").eq("id", userId).maybeSingle();
  if (!row?.pin_hash) return { status: "no_pin" };

  if (!verifyPin(pin, row.pin_hash)) {
    return { status: "wrong", attemptsLeft: begin.attempts_left, lockedUntil: begin.locked_until || null };
  }

  await supabase.rpc("pin_attempt_success", { p_user_id: userId });
  return { status: "ok" };
}

// Turns a checkPin result into the HTTP error to send (null when ok).
export function pinFailureResponse(result) {
  switch (result.status) {
    case "ok":
      return null;
    case "invalid":
      return NextResponse.json({ error: "Enter your 4–8 digit PIN." }, { status: 400 });
    case "no_pin":
      return NextResponse.json({ error: "This account has no PIN set. Set one in your Profile first." }, { status: 400 });
    case "locked": {
      const seconds = result.lockedUntil ? Math.max(1, Math.ceil((new Date(result.lockedUntil).getTime() - Date.now()) / 1000)) : PIN_LOCK_MINUTES * 60;
      const res = NextResponse.json(
        { error: `Too many wrong PINs. Try again in ${Math.ceil(seconds / 60)} minute${seconds > 90 ? "s" : ""}.`, retry_after_seconds: seconds },
        { status: 429 }
      );
      res.headers.set("Retry-After", String(seconds));
      return res;
    }
    case "unavailable":
      return NextResponse.json({ error: result.message }, { status: 500 });
    default: {
      const left = result.attemptsLeft;
      const msg =
        result.lockedUntil || left === 0
          ? `That PIN isn't right. Too many tries — locked for ${PIN_LOCK_MINUTES} minutes.`
          : `That PIN isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`;
      return NextResponse.json({ error: msg, attempts_left: left }, { status: 401 });
    }
  }
}

// Stamps THIS session (the cookie's token) as freshly PIN-verified.
export async function markSessionPinVerified(req) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const supabase = supabaseServer();
  const { error } = await supabase.from("sessions").update({ pin_verified_at: new Date().toISOString() }).eq("token", token);
  invalidateSessionToken(token); // the next request must see the new stamp
  return !error;
}

// Sets this session's Admin Privileges switch and drops its cached copy so
// the very next request sees it (v71 #19: "off" must be immediate).
export async function setSessionAdminMode(req, on) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const supabase = supabaseServer();
  const { error } = await supabase.from("sessions").update({ admin_mode: Boolean(on) }).eq("token", token);
  invalidateSessionToken(token);
  return !error;
}
