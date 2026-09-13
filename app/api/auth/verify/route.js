import { NextResponse } from "next/server";
import { redeemMagicLink } from "@/lib/magicLink";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSession, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE } from "@/lib/session";

export async function GET(req) {
  const token = req.nextUrl.searchParams.get("token");
  const baseUrl = req.nextUrl.origin;

  const email = await redeemMagicLink(token);
  if (!email) {
    return NextResponse.redirect(
      `${baseUrl}/?authError=${encodeURIComponent("That link has expired or was already used. Request a new one.")}`
    );
  }

  const supabase = supabaseServer();

  // Find or create the user row. First-time verification for a brand new
  // email creates the row here; username/display_name stay null until
  // /api/auth/complete-signup runs.
  let { data: user, error } = await supabase
    .from("users")
    .select("id, username")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/?authError=${encodeURIComponent("Something went wrong. Try again.")}`
    );
  }

  if (!user) {
    const { data: created, error: createError } = await supabase
      .from("users")
      .insert({ email })
      .select("id, username")
      .single();

    if (createError) {
      return NextResponse.redirect(
        `${baseUrl}/?authError=${encodeURIComponent("Something went wrong creating your account. Try again.")}`
      );
    }
    user = created;
  }

  const sessionToken = await createSession(user.id);

  // New account (no username yet) -> first-time setup, which now also
  // collects the initial PIN. Existing account -> this magic link was
  // used for recovery (forgot PIN), so land on the PIN reset screen
  // rather than straight into the app -- per the project's decision,
  // magic link is for setup and recovery only, never an ongoing
  // alternative to signing in with a PIN.
  const destination = user.username ? "/reset-pin" : "/setup";
  const response = NextResponse.redirect(`${baseUrl}${destination}`);
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: "/",
  });

  return response;
}
