import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";
import { logActivity } from "@/lib/activityLog";
import { PLANS, DEFAULT_PLAN_ID } from "@/lib/planRegistry";
import { withPrivateCache } from "@/lib/cacheHeaders";

const VALID_FEATURES = ["songs_setlists", "reading_plan_journal", "programs"];
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
    .select("id, name, type, features, image_url, tile_color, description, reading_plan_locked, reading_plan_id")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  return withPrivateCache({ group: data });
}

export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id } = await params;
  const { name, type, features, tile_color, description, reading_plan_locked, reading_plan_id, hidden, hide_restricts_access } =
    await req.json();

  const updates = { updated_at: new Date().toISOString() };

  // Renaming a ministry -- and its type/category label -- is delegated to
  // its own leader too, per the project's decision. features stays
  // admin-only below, since toggling a whole module on/off is a bigger
  // deal than a display label.
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
  if (type !== undefined) {
    if (!(await canManageGroup(user, id))) {
      return NextResponse.json(
        { error: "Only this group's leaders or a Church Admin can change its type label." },
        { status: 403 }
      );
    }
    updates.type = type.trim();
  }

  if (description !== undefined) {
    if (!(await canManageGroup(user, id))) {
      return NextResponse.json(
        { error: "Only this group's leaders or a Church Admin can change its description." },
        { status: 403 }
      );
    }
    updates.description = description.trim() || null;
  }

  // features stays admin-only -- enabling/disabling a whole module
  // (Songs/Setlists, Reading Plan/Journal) affects what the ministry can
  // do, not just its label, so it's kept a step above name/type/color.
  if (features !== undefined) {
    if (!user.is_church_admin) {
      return NextResponse.json({ error: "Church Admin access required for that change." }, { status: 403 });
    }
    updates.features = Array.isArray(features) ? features.filter((f) => VALID_FEATURES.includes(f)) : [];
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

  // Whether the ministry's reading plan is locked to one plan for
  // everyone, and which plan -- the ministry's own leader decides this,
  // same authority level as its other cosmetic/behavioral choices.
  if (reading_plan_locked !== undefined || reading_plan_id !== undefined) {
    if (!(await canManageGroup(user, id))) {
      return NextResponse.json(
        { error: "Only this group's leaders or a Church Admin can change its reading plan settings." },
        { status: 403 }
      );
    }
    if (reading_plan_locked !== undefined) updates.reading_plan_locked = Boolean(reading_plan_locked);
    if (reading_plan_id !== undefined) {
      if (!PLANS[reading_plan_id]) {
        return NextResponse.json({ error: "That's not a recognized reading plan." }, { status: 400 });
      }
      updates.reading_plan_id = reading_plan_id;
    }
  }

  // Hiding a ministry -- and whether that also cuts off existing
  // members' access -- is admin-only. This is a bigger deal than the
  // ministry's own cosmetic choices (name/color/etc, which a leader can
  // set): it's the admin deciding whether a ministry is discoverable at
  // all, and separately, whether it's effectively taken offline for
  // people already in it. See migration_023 and lib/groupAuth.js for
  // where hide_restricts_access is actually enforced.
  if (hidden !== undefined || hide_restricts_access !== undefined) {
    if (!user.is_church_admin) {
      return NextResponse.json({ error: "Church Admin access required for that change." }, { status: 403 });
    }
    if (hidden !== undefined) updates.hidden = Boolean(hidden);
    if (hide_restricts_access !== undefined) updates.hide_restricts_access = Boolean(hide_restricts_access);
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

  // Fetch the name before deleting -- needed for a meaningful log entry,
  // since it won't be recoverable from the row afterward.
  const { data: group } = await supabase.from("groups").select("name").eq("id", id).maybeSingle();

  const { error } = await supabase.from("groups").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logActivity(user.id, "ministry_deleted", group?.name ? `Deleted "${group.name}"` : null);
  return NextResponse.json({ ok: true });
}
