import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { PLANS } from "@/lib/planRegistry";
import { withPrivateCache } from "@/lib/cacheHeaders";

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  return withPrivateCache({ active_reading_plan: user.active_reading_plan || "foundations" });
}

export async function PATCH(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { plan_id } = await req.json();
  if (!PLANS[plan_id]) {
    return NextResponse.json({ error: "That's not a recognized reading plan." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("users")
    .update({ active_reading_plan: plan_id, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
