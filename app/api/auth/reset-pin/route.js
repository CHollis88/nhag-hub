import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { hashPin } from "@/lib/pin";

const PIN_RE = /^\d{4,8}$/;

// Reached only after a magic-link recovery verify -- the person has just
// proven email ownership, so this is allowed to overwrite the existing
// PIN outright, no old-PIN confirmation needed. The new hash lands in the
// database, not any browser's local storage, so it's immediately usable
// from any device or app instance -- including going straight back to an
// installed iOS home-screen app afterward.
export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { pin } = await req.json();
  if (!PIN_RE.test(pin || "")) {
    return NextResponse.json({ error: "PIN must be 4–8 digits." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("users")
    .update({ pin_hash: hashPin(pin), updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
