import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

// v72: remember onboarding choices on the ACCOUNT (users.onboarding).
// POST { decline: "photo" }       -> "No thanks" to a setup item, for good
// POST { undecline: "photo" }     -> changed their mind
// POST { done: "bible" }         -> did a setup item the app can't see by
//                                   itself on every device (picking a Bible)
// POST { walkthrough_done: true } -> finished or skipped the walkthrough
// POST { tour_seen: "72.0" }     -> saw that version's "What's new" tour
// One small write, only when someone taps one of those buttons.

const ITEMS = new Set(["photo", "notifications", "install", "ministry", "bible"]);

export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const supabase = supabaseServer();

  const { data, error } = await supabase.from("users").select("onboarding").eq("id", user.id).maybeSingle();
  if (error) {
    // migration_041 not run yet: nothing to save to; the phone still remembers.
    return NextResponse.json({ ok: false, onboarding: {} });
  }
  const current = data?.onboarding && typeof data.onboarding === "object" ? data.onboarding : {};
  const declined = new Set(Array.isArray(current.declined) ? current.declined.filter((x) => ITEMS.has(x)) : []);
  if (ITEMS.has(body.decline)) declined.add(body.decline);
  if (ITEMS.has(body.undecline)) declined.delete(body.undecline);
  const done = new Set(Array.isArray(current.done) ? current.done.filter((x) => ITEMS.has(x)) : []);
  if (ITEMS.has(body.done)) done.add(body.done);
  const next = { ...current, declined: [...declined], done: [...done] };
  if (body.walkthrough_done === true) next.walkthrough_done = true;
  if (typeof body.tour_seen === "string" && /^\d+\.\d+$/.test(body.tour_seen)) next.tour_seen = body.tour_seen;

  const { error: upErr } = await supabase.from("users").update({ onboarding: next }).eq("id", user.id);
  if (upErr) return NextResponse.json({ error: "Couldn't save that." }, { status: 500 });
  return NextResponse.json({ ok: true, onboarding: next });
}
