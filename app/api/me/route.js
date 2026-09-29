import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";
import { withColumnFallback } from "@/lib/compat";
import { invalidateUserSessions } from "@/lib/session";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

// Returns the current user plus every group they have an active or pending
// relationship with. This is for client-side UI decisions (which nav items
// to show, etc.) only — every mutating route re-checks authority itself and
// never trusts anything the client infers from this response.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const supabase = supabaseServer();
  const MEMBER_COLS = "group_id, role, status, groups(id, name, type, features, image_url, tile_color, hidden, hide_restricts_access";
  const { data: memberships, error } = await withColumnFallback(
    () => supabase.from("group_members").select(`${MEMBER_COLS}, archived_at)`).eq("user_id", user.id),
    () => supabase.from("group_members").select(`${MEMBER_COLS})`).eq("user_id", user.id)
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // A group hidden with hide_restricts_access=true is meant to be fully
  // offline for everyone except a Church Admin (see lib/groupAuth.js and
  // /api/groups's GET) -- so it's dropped from a non-admin's own
  // memberships too. Otherwise Home would still show an active "Launch"
  // tile for it that 403s the moment it's tapped. hidden=true alone
  // (discovery-only) does NOT drop it here -- an existing member keeps
  // full access, only OTHER people's discovery of it is affected.
  //
  // Per-user hiding (migration_029) already removes the membership row
  // itself at the moment an admin applies it, so this filter is a
  // defensive backstop, not the primary enforcement -- it keeps this
  // response consistent with /api/groups if a pending row ever survives.
  let userHiddenIds = new Set();
  if (!user.is_church_admin) {
    const { data: userHidden } = await supabase
      .from("user_hidden_groups")
      .select("group_id")
      .eq("user_id", user.id);
    userHiddenIds = new Set((userHidden || []).map((r) => r.group_id));
  }

  // v71 #24: an ARCHIVED ministry drops off everyone's Home, admins included
  // (an admin restores it from the Toolbox, they don't launch it).
  const notArchived = (memberships || []).filter((m) => !m.groups?.archived_at);
  const visibleMemberships = user.is_church_admin
    ? notArchived
    : notArchived.filter(
        (m) => !(m.groups?.hidden && m.groups?.hide_restricts_access) && !userHiddenIds.has(m.group_id)
      );

  return withNoStore({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.display_name,
        bio: user.bio,
        // v71 #19: EFFECTIVE admin (role AND this device's Admin Privileges
        // switch). The screens use this to decide what to show; the server
        // re-checks it on every request regardless.
        is_church_admin: user.is_church_admin,
        // The underlying role and the switch, for Settings' "Use Admin
        // Privileges" control (only meaningful to someone who holds the role).
        has_admin_role: user.has_admin_role,
        admin_mode: user.admin_mode,
        // v71: false when this admin has turned OFF admin-duty notifications.
        admin_notifications_enabled: user.admin_notifications_enabled,
      },
      memberships: visibleMemberships.map((m) => ({
        group_id: m.group_id,
        role: m.role,
        status: m.status,
        group: m.groups,
      })),
    });
}

// Editing your own name/username -- same validation rules as initial
// account setup, so a changed username can't end up in a state the
// signup flow itself would never have allowed.
export async function PATCH(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { username, display_name, bio } = await req.json();
  const updates = { updated_at: new Date().toISOString() };

  if (display_name !== undefined) {
    const trimmed = display_name.trim();
    if (!trimmed) return NextResponse.json({ error: "Display name is required." }, { status: 400 });
    updates.display_name = trimmed;
  }
  if (username !== undefined) {
    const normalized = username.trim().toLowerCase();
    if (!USERNAME_RE.test(normalized)) {
      return NextResponse.json(
        { error: "Username must be 3–20 characters: lowercase letters, numbers, and underscores only." },
        { status: 400 }
      );
    }
    updates.username = normalized;
  }
  // Empty string clears the bio rather than being rejected -- "I don't
  // want to share this anymore" is a valid edit, not an error.
  if (bio !== undefined) updates.bio = bio.trim().slice(0, 500);

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", user.id)
    .select("username, display_name, bio")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  invalidateUserSessions(user.id);
  return NextResponse.json({ user: data });
}
