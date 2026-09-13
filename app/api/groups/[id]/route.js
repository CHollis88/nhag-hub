import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";

const VALID_FEATURES = ["songs_setlists", "reading_plan_journal"];
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

// Single-group detail fetch -- used by RosterTab's appearance panel to
// show the group's current icon/color before changing them, without
// needing the full /api/groups list.
export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id } = await params;
  if (!(await isActiveGroupMember(user, id))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, type, features, image_url, tile_color")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  return NextResponse.json({ group: data });
}

export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id } = await params;
  const { name, type, features, tile_color } = await req.json();

  const updates = { updated_at: new Date().toISOString() };

  // Renaming a ministry is delegated to its own leader too, per the
  // project's decision -- unlike type/features (below), a name change
  // doesn't affect how the ministry behaves, just what it's called.
  if (name !== undefined) {
    if (!(await canManageGroup(user, id))) {
      return NextResponse.json(
        { error: "Only this group's leaders or a Church Admin can rename it." },
        { status: 403 }
      );
    }
    if (!name.trim()) return NextResponse.json({ error: "name cannot be empty." }, { status: 400 });
    updates.name = name.trim();
  }

  // type/features stay admin-only -- these affect the whole app's
  // ministry list and which modules are enabled, not just this group's
  // own look or label.
  if (type !== undefined || features !== undefined) {
    if (!user.is_church_admin) {
      return NextResponse.json({ error: "Church Admin access required for that change." }, { status: 403 });
    }
    if (type !== undefined) updates.type = type.trim();
    if (features !== undefined) {
      updates.features = Array.isArray(features) ? features.filter((f) => VALID_FEATURES.includes(f)) : [];
    }
  }

  // Tile color is cosmetic to this one ministry -- its own leader can set
  // it too, not just a Church Admin, per the project's decision to let
  // each ministry pick its own tile color.
  if (tile_color !== undefined) {
    if (!(await canManageGroup(user, id))) {
      return NextResponse.json(
        { error: "Only this group's leaders or a Church Admin can change its tile color." },
        { status: 403 }
      );
    }
    if (tile_color !== null && !HEX_COLOR_RE.test(tile_color)) {
      return NextResponse.json({ error: "tile_color must be a hex color like #8B1E2F." }, { status: 400 });
    }
    updates.tile_color = tile_color;
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("groups")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  return NextResponse.json({ group: data });
}

// Hard delete, per the project's decision that group deletion doesn't need
// to preserve/archive anything. Cascades to group_members and
// group_promotion_requests via foreign key ON DELETE CASCADE.
export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = supabaseServer();
  const { error } = await supabase.from("groups").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
