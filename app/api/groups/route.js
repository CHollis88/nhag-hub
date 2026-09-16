import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { logActivity } from "@/lib/activityLog";

// Recognized feature keys. There's no fixed set of ministry "types" --
// type is just a free-text label -- but features are a controlled set
// since each one corresponds to real UI/tabs the app knows how to render.
// Adding a new feature later means adding a key here, not a schema change.
const VALID_FEATURES = ["songs_setlists", "reading_plan_journal"];
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

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
  const { data: groups, error } = await supabase
    .from("groups")
    .select("id, name, type, features, image_url, tile_color, description, created_at")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach each group's active leader name(s) -- Home's ministry tiles
  // show these, and a group can have more than one leader (see
  // group_members, no uniqueness constraint on role within a group).
  const { data: leaderRows } = await supabase
    .from("group_members")
    .select("group_id, users(display_name)")
    .eq("role", "leader")
    .eq("status", "active");

  const leadersByGroup = {};
  for (const row of leaderRows || []) {
    if (!leadersByGroup[row.group_id]) leadersByGroup[row.group_id] = [];
    if (row.users?.display_name) leadersByGroup[row.group_id].push(row.users.display_name);
  }

  const withLeaders = groups.map((g) => ({ ...g, leaders: leadersByGroup[g.id] || [] }));
  return NextResponse.json({ groups: withLeaders });
}

export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { name, type, features, tile_color } = await req.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }
  if (tile_color && !HEX_COLOR_RE.test(tile_color)) {
    return NextResponse.json({ error: "tile_color must be a hex color like #8B1E2F." }, { status: 400 });
  }

  const cleanFeatures = Array.isArray(features) ? features.filter((f) => VALID_FEATURES.includes(f)) : [];

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("groups")
    .insert({
      name: name.trim(),
      type: (type || "").trim(),
      features: cleanFeatures,
      tile_color: tile_color || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logActivity(user.id, "ministry_created", `Created "${data.name}"`);
  return NextResponse.json({ group: data });
}
