import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isValidTranslation } from "@/lib/bibleTranslations";

// v72: the Bible translation follows the ACCOUNT (users.preferred_translation,
// a column that existed since migration_032 but was never written). Saved
// each time someone picks one; /api/me hands it back so every device opens
// in it. Also ticks "Pick your Bible" on the setup checklist.
export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { translation } = await req.json().catch(() => ({}));
  if (!isValidTranslation(translation)) return NextResponse.json({ error: "Unknown translation." }, { status: 400 });
  const supabase = supabaseServer();

  const { error } = await supabase.from("users").update({ preferred_translation: translation }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Couldn't save your translation." }, { status: 500 });

  // Mark the checklist item done (only if the onboarding column exists).
  const { data } = await supabase.from("users").select("onboarding").eq("id", user.id).maybeSingle();
  if (data && data.onboarding !== undefined) {
    const cur = data.onboarding && typeof data.onboarding === "object" ? data.onboarding : {};
    const done = new Set(Array.isArray(cur.done) ? cur.done : []);
    if (!done.has("bible")) {
      done.add("bible");
      await supabase.from("users").update({ onboarding: { ...cur, done: [...done] } }).eq("id", user.id);
    }
  }
  return NextResponse.json({ ok: true, translation });
}
