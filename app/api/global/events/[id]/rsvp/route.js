import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

const VALID_STATUSES = ["yes", "no", "maybe"];

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("global_event_rsvps")
    .select("status, updated_at, users(display_name)")
    .eq("event_id", params.id)
    .order("updated_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rsvps: data });
}

export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { status } = await req.json();
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("global_event_rsvps")
    .upsert(
      { event_id: params.id, user_id: user.id, status, updated_at: new Date().toISOString() },
      { onConflict: "event_id,user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rsvp: data });
}
