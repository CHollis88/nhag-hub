import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { subscription } = await req.json();
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "A valid subscription is required." }, { status: 400 });
  }

  const supabase = supabaseServer();
  // A given browser's subscription endpoint is effectively unique to that
  // install -- avoid piling up duplicate rows if subscribe gets called
  // more than once for the same device.
  const { data: existing } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .contains("subscription", { endpoint: subscription.endpoint })
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from("push_subscriptions").insert({ user_id: user.id, subscription });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Removes ALL of this user's subscriptions on this call, not just one
// device -- matches the client's "Notifications off" switch, which acts
// on the current device's browser-level unsubscribe plus this cleanup.
export async function DELETE(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();
  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
