import { NextResponse } from "next/server";
import { issueMagicLink, sendMagicLinkEmail } from "@/lib/magicLink";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  const { email } = await req.json();

  if (!email || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const token = await issueMagicLink(normalizedEmail);

  const baseUrl = process.env.APP_URL || req.nextUrl.origin;
  const link = `${baseUrl}/auth/verify?token=${token}`;

  await sendMagicLinkEmail(normalizedEmail, link);

  // Always return success regardless of whether this email has an existing
  // account — the link itself handles both signup and login, so there's no
  // "does this email exist" signal to leak either way.
  return NextResponse.json({ ok: true });
}
