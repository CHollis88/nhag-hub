import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkPin, pinFailureResponse, markSessionPinVerified, PIN_VERIFY_WINDOW_MS } from "@/lib/adminAuth";
import { logActivity } from "@/lib/activityLog";

// v71 #21 -- "Enter your PIN to continue." Verifies the signed-in admin's
// PIN and, on success, stamps THIS session so the gated actions (grant or
// remove admin, delete a ministry, sign someone out everywhere) are
// accepted for the next few minutes. Attempts are counted in the database
// and lock out after 5 wrong tries (migration_035).
//
// Only someone who holds the admin role can use it: there's nothing to
// unlock for anyone else, and it keeps the endpoint from being a general
// PIN-guessing surface.
export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!user.has_admin_role) return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });

  const { pin } = await req.json().catch(() => ({}));
  const result = await checkPin(user.id, pin);

  const failure = pinFailureResponse(result);
  if (failure) {
    // Wrong PINs are a security signal -- worth a line in the log.
    if (result.status === "wrong") {
      logActivity(
        user.id,
        "admin_pin_failed",
        result.lockedUntil
          ? `${user.display_name} entered a wrong PIN too many times and was locked out for 15 minutes`
          : `${user.display_name} entered a wrong PIN`,
        { attempts_left: result.attemptsLeft }
      );
    }
    return failure;
  }

  const stamped = await markSessionPinVerified(req);
  if (!stamped) return NextResponse.json({ error: "Couldn't record that. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true, valid_for_seconds: Math.round(PIN_VERIFY_WINDOW_MS / 1000) });
}
