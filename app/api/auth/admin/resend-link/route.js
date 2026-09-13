import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { issueMagicLink, sendMagicLinkEmail } from "@/lib/magicLink";

export async function POST(req) {
  const admin = await getCurrentUser(req);
  if (!admin?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { user_id } = await req.json();
  if (!user_id) {
    return NextResponse.json({ error: "user_id is required." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: targetUser, error } = await supabase
    .from("users")
    .select("email")
    .eq("id", user_id)
    .maybeSingle();

  if (error || !targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const token = await issueMagicLink(targetUser.email);
  const baseUrl = process.env.APP_URL || req.nextUrl.origin;
  const link = `${baseUrl}/auth/verify?token=${token}`;
  await sendMagicLinkEmail(targetUser.email, link);

  return NextResponse.json({ ok: true });
}
