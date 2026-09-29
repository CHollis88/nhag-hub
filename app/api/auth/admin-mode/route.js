import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkPin, pinFailureResponse, setSessionAdminMode } from "@/lib/adminAuth";
import { logActivity } from "@/lib/activityLog";
import { supabaseServer } from "@/lib/supabaseServer";

// v71 #19 / #20 -- "Use Admin Privileges".
//
// OFF is immediate and needs nothing: from that moment THIS session is
// treated by the server as a regular member (the admin role itself is never
// removed). It's a safety net -- use the app day to day without the power
// to delete things by accident, or hand your phone to someone.
//
// ON needs the PIN, and is logged: it is the way back to power, so it must
// prove it's really you. (Turning it off is always safe, so it's never
// gated -- the switch can't lock anyone out for long.)
export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!user.has_admin_role) return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });

  const { on, pin } = await req.json().catch(() => ({}));
  if (typeof on !== "boolean") return NextResponse.json({ error: "on must be true or false." }, { status: 400 });

  if (on) {
    if (user.admin_mode) return NextResponse.json({ ok: true, admin_mode: true }); // already on
    const result = await checkPin(user.id, pin);
    const failure = pinFailureResponse(result);
    if (failure) {
      if (result.status === "wrong") {
        logActivity(user.id, "admin_pin_failed", `${user.display_name} entered a wrong PIN trying to turn Admin Privileges on`, {
          attempts_left: result.attemptsLeft,
        });
      }
      return failure;
    }
  } else {
    if (!user.admin_mode) return NextResponse.json({ ok: true, admin_mode: false }); // already off
    // Never let someone switch themselves into a state they can't get out
    // of: turning back on needs a PIN, so they must have one.
    const { data: row } = await supabaseServer().from("users").select("pin_hash").eq("id", user.id).maybeSingle();
    if (!row?.pin_hash) {
      return NextResponse.json(
        { error: "Set a PIN in your Profile first — you'll need it to turn Admin Privileges back on." },
        { status: 400 }
      );
    }
  }

  const saved = await setSessionAdminMode(req, on);
  if (!saved) return NextResponse.json({ error: "Couldn't change that. Please try again." }, { status: 500 });

  logActivity(user.id, on ? "admin_privileges_enabled" : "admin_privileges_disabled",
    `${user.display_name} turned Admin Privileges ${on ? "on" : "off"}`);
  return NextResponse.json({ ok: true, admin_mode: on });
}
