import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";
import { withNoStore } from "@/lib/cacheHeaders";

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

// Any active member of the group can see its Programs tab -- same read
// access level as Songs/Setlists. Hidden programs (migration_025) are
// filtered out here for anyone who isn't a leader/admin of the parent
// group, same "shouldn't even know it exists" pattern as leader-only
// News posts -- a hidden program's card just doesn't appear in the grid
// for a regular member, rather than appearing greyed-out or locked.
export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("programs")
    .select("id, name, image_url, tile_color, hidden, created_at")
    .eq("group_id", groupId)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const canManage = await canManageGroup(user, groupId);
  const visible = canManage ? data : data.filter((p) => !p.hidden);

  return withNoStore({ programs: visible });
}

// Creating a program is leader/admin territory, same authority level as
// creating a setlist or adding a song -- members can view, not create.
export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can create a program." },
      { status: 403 }
    );
  }

  const { name, tile_color } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }
  if (tile_color !== undefined && tile_color !== null && !HEX_COLOR_RE.test(tile_color)) {
    return NextResponse.json({ error: "tile_color must be a hex color like #8B1E2F." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("programs")
    .insert({ group_id: groupId, name: name.trim(), tile_color: tile_color || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ program: data });
}
