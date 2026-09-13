import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { username, display_name } = await req.json();
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

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("users")
    .update({
      username: normalizedUsername,
      display_name: trimmedDisplayName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
