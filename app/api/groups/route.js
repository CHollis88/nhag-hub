import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

// Recognized feature keys. There's no fixed set of ministry "types" --
// type is just a free-text label -- but features are a controlled set
// since each one corresponds to real UI/tabs the app knows how to render.
// Adding a new feature later means adding a key here, not a schema change.
const VALID_FEATURES = ["songs_setlists", "reading_plan_journal"];

// Any signed-in user can list all groups — this powers "browse groups you're
// not in yet, to request joining." It intentionally does not filter by
// membership; that filtering happens client-side against /api/me's
// memberships list, since seeing that a group exists is not sensitive.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, type, features, created_at")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ groups: data });
}

export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { name, type, features } = await req.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const cleanFeatures = Array.isArray(features) ? features.filter((f) => VALID_FEATURES.includes(f)) : [];

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("groups")
    .insert({ name: name.trim(), type: (type || "").trim(), features: cleanFeatures })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: data });
}
