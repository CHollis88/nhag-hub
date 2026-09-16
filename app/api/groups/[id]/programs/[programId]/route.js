import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";
import { withPrivateCache } from "@/lib/cacheHeaders";

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("programs")
    .select("id, name, image_url, tile_color, hidden, created_at")
    .eq("id", programId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Program not found." }, { status: 404 });

  // A hidden program is still directly reachable by a leader/admin (they
  // need to be able to open it to un-hide it or manage it) but not by a
  // regular member who somehow has its ID -- matches it being excluded
  // from the list entirely for them.
  if (data.hidden && !(await canManageGroup(user, groupId))) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  return withPrivateCache({ program: data });
}

export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can edit a program." },
      { status: 403 }
    );
  }

  const { name, tile_color, hidden } = await req.json();
  const updates = { updated_at: new Date().toISOString() };
  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: "name cannot be empty." }, { status: 400 });
    updates.name = name.trim();
  }
  if (tile_color !== undefined) {
    if (tile_color !== null && !HEX_COLOR_RE.test(tile_color)) {
      return NextResponse.json({ error: "tile_color must be a hex color like #8B1E2F." }, { status: 400 });
    }
    updates.tile_color = tile_color;
  }
  // Per-program hiding -- same leader/admin authority as everything
  // else about a program, distinct from ministry-level hiding
  // (migration_023), which is admin-only. A leader who can create and
  // manage a program can also hide it, since it's their own content.
  if (hidden !== undefined) updates.hidden = Boolean(hidden);

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("programs")
    .update(updates)
    .eq("id", programId)
    .eq("group_id", groupId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Program not found." }, { status: 404 });
  return NextResponse.json({ program: data });
}

// Cascades to remove its songs, setlists, and documents (all reference
// program_id with on delete cascade -- see migration_025). A real
// consequence worth confirming client-side before calling this.
export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can delete a program." },
      { status: 403 }
    );
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("programs").delete().eq("id", programId).eq("group_id", groupId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
