import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

// Exact-match username lookup. Any signed-in user can call this (it's only
// used in the "add someone to my group" flow, gated separately by
// canManageGroup on the actual add), and it returns only the minimal
// public fields needed to confirm you found the right person — never
// email, never a browsable list of all users.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const username = req.nextUrl.searchParams.get("username")?.trim().toLowerCase();
  if (!username) {
    return NextResponse.json({ error: "username is required." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("users")
    .select("id, username, display_name")
    .ilike("username", username)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No user found with that username." }, { status: 404 });
  return NextResponse.json({ user: data });
}
