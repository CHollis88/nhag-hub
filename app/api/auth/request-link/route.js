import { NextResponse } from "next/server";
import { issueMagicLink, sendMagicLinkEmail } from "@/lib/magicLink";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  const { email } = await req.json();

  if (!email || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const token = await issueMagicLink(normalizedEmail);

    const baseUrl = process.env.APP_URL || req.nextUrl.origin;
    const link = `${baseUrl}/api/auth/verify?token=${token}`;

    await sendMagicLinkEmail(normalizedEmail, link);
  } catch (err) {
    // Previously this could throw uncaught -- e.g. a missing
    // RESEND_API_KEY or a rejected Resend API call -- which crashed the
    // route with no JSON body at all, showing up client-side as a
    // confusing "Unexpected end of JSON input" instead of the real
    // problem. Surfacing the actual message here makes future
    // misconfiguration (bad key, wrong provider setting) diagnosable
    // from the browser instead of requiring a trip to server logs.
    console.error("request-link failed:", err);
    return NextResponse.json(
      { error: `Couldn't send the sign-in link: ${err.message}` },
      { status: 500 }
    );
  }

  // Always return success regardless of whether this email has an existing
  // account — the link itself handles both signup and login, so there's no
  // "does this email exist" signal to leak either way.
  return NextResponse.json({ ok: true });
}
