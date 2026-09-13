import crypto from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";

const LINK_LIFETIME_MS = 15 * 60 * 1000; // 15 minutes

function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

// Invalidates any unused links for this email, then issues a fresh one.
// Returns the raw token (the caller builds the actual URL and sends it).
export async function issueMagicLink(email) {
  const supabase = supabaseServer();
  const normalizedEmail = email.trim().toLowerCase();

  // Delete rather than mark-used: an old unused link should simply stop
  // existing once superseded, so there's only ever one "live" link per
  // email at a time. Already-redeemed links (used_at set) are irrelevant
  // history at this point and get cleaned up here too, keeping the table
  // small.
  await supabase.from("magic_links").delete().eq("email", normalizedEmail);

  const token = randomToken();
  const expiresAt = new Date(Date.now() + LINK_LIFETIME_MS).toISOString();

  const { error } = await supabase.from("magic_links").insert({
    email: normalizedEmail,
    token,
    expires_at: expiresAt,
  });

  if (error) throw new Error(error.message);
  return token;
}

// Redeems a token: validates it, marks it used, and returns the email it
// was issued for. Returns null if the token is missing, expired, or
// already used — callers should treat null as "request a new link."
export async function redeemMagicLink(token) {
  if (!token) return null;
  const supabase = supabaseServer();

  const { data: link, error } = await supabase
    .from("magic_links")
    .select("id, email, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !link) return null;
  if (link.used_at) return null;
  if (new Date(link.expires_at).getTime() < Date.now()) return null;

  const { error: updateError } = await supabase
    .from("magic_links")
    .update({ used_at: new Date().toISOString() })
    .eq("id", link.id);

  if (updateError) return null;
  return link.email;
}

// Email delivery is intentionally abstracted behind this one function.
// In development (EMAIL_PROVIDER unset or "none"), this just logs the
// link so the whole auth flow is testable without sending real email.
// With EMAIL_PROVIDER=resend, it sends via Resend's API using plain
// fetch — no SDK dependency needed for something this simple.
export async function sendMagicLinkEmail(email, link) {
  if (process.env.EMAIL_PROVIDER === "none" || !process.env.EMAIL_PROVIDER) {
    console.log(`[dev magic link] ${email} -> ${link}`);
    return;
  }

  if (process.env.EMAIL_PROVIDER === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("EMAIL_PROVIDER=resend but RESEND_API_KEY is not set.");
    }

    // Until a sending domain is verified in Resend, the "from" address
    // must be onboarding@resend.dev, and Resend will only actually
    // deliver to the email address the Resend account itself is
    // registered under — everyone else's send will silently fail
    // sandbox-side. Once a real domain (e.g. mail.nhag.org) is verified
    // in Resend's dashboard, set EMAIL_FROM to an address on that domain
    // and this starts working for every recipient.
    const from = process.env.EMAIL_FROM || "North Hodge Assembly of God <onboarding@resend.dev>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Sign in to the NHAG Church Hub",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
            <p style="color:#16296B; font-weight: bold; font-size: 18px;">North Hodge Assembly of God</p>
            <p>Tap the link below to sign in. It expires in 15 minutes and only works once.</p>
            <p><a href="${link}" style="color:#16296B;">${link}</a></p>
            <p style="color:#888;font-size:13px">If you didn't request this, you can ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend API error (${res.status}): ${body}`);
    }
    return;
  }

  throw new Error(
    `EMAIL_PROVIDER=${process.env.EMAIL_PROVIDER} is not wired up yet. ` +
      `Implement sending in lib/magicLink.js sendMagicLinkEmail().`
  );
}
