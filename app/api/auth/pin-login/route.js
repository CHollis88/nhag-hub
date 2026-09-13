import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyPin } from "@/lib/pin";
import { createSession, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE } from "@/lib/session";

// This is the primary, day-to-day sign-in method. Unlike a magic link,
// there's nothing here tied to a specific browser or app instance -- it's
// a plain username+PIN check against the database, so it works exactly
// the same whether it's typed into Safari, Chrome, or an installed
// home-screen app on iOS. That's the whole point: it sidesteps the iOS
// storage-isolation problem that makes magic links unusable for an
// already-installed app.
export async function POST(req) {
  const { username, pin } = await req.json();
  const normalizedUsername = (username || "").trim().toLowerCase();

  if (!normalizedUsername || !pin) {
    return NextResponse.json({ error: "Username and PIN are required." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: user, error } = await supabase
    .from("users")
    .select("id, pin_hash")
    .ilike("username", normalizedUsername)
    .maybeSingle();

  // Deliberately generic error either way -- doesn't reveal whether the
  // username exists, only that the combination didn't work.
  if (error || !user || !verifyPin(pin, user.pin_hash)) {
    return NextResponse.json({ error: "Incorrect username or PIN." }, { status: 401 });
  }

  const sessionToken = await createSession(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}
