import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withPrivateCache } from "@/lib/cacheHeaders";
import { hashPin } from "@/lib/pin";
import { logActivity } from "@/lib/activityLog";
import crypto from "crypto";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const PIN_RE = /^\d{4,8}$/;

// Admin-only. Unlike /api/users/lookup (deliberately narrow, exact-match
// only, for the "add someone to my group" flow), this genuinely lists
// every account -- but only to a Church Admin, for the specific purpose
// of promoting/demoting admin access.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("users")
    .select("id, username, display_name, is_church_admin")
    .not("username", "is", null)
    .order("display_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return withPrivateCache({ users: data });
}

// Admin-only. Creates a fully complete account directly, bypassing the
// magic-link email flow entirely -- for someone with no email address of
// their own (e.g. a member with a disability who can't manage email, but
// can still tap in a PIN). `users.email` is not-null-unique at the DB
// level, so a placeholder address is generated (never sent anywhere,
// never used for sign-in) just to satisfy that constraint; PIN login is
// the ONLY way this account ever signs in. The admin sets the PIN here
// and hands the device to the person already signed in on the setup
// screen, or gives them the username/PIN to type in themselves.
export async function POST(req) {
  const admin = await getCurrentUser(req);
  if (!admin?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { username, display_name, pin } = await req.json();
  const normalizedUsername = (username || "").trim().toLowerCase();
  const trimmedDisplayName = (display_name || "").trim();

  if (!USERNAME_RE.test(normalizedUsername)) {
    return NextResponse.json(
      { error: "Username must be 3–20 characters: lowercase letters, numbers, and underscores only." },
      { status: 400 }
    );
  }
  if (!trimmedDisplayName) {
    return NextResponse.json({ error: "Display name is required." }, { status: 400 });
  }
  if (!PIN_RE.test(pin || "")) {
    return NextResponse.json({ error: "PIN must be 4–8 digits." }, { status: 400 });
  }

  // Placeholder address: unique, unreachable, and clearly marked as such
  // if it's ever seen in a database view -- "no-email.<random>@accounts.local"
  // rather than anything that looks like a real address someone might
  // mistakenly try to email.
  const placeholderEmail = `no-email.${crypto.randomBytes(8).toString("hex")}@accounts.local`;

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("users")
    .insert({
      email: placeholderEmail,
      username: normalizedUsername,
      display_name: trimmedDisplayName,
      pin_hash: hashPin(pin),
    })
    .select("id, username, display_name, is_church_admin")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logActivity(admin.id, "no_email_account_created", `Created a no-email account for ${trimmedDisplayName}`);
  return NextResponse.json({ user: data });
}
