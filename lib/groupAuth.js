import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// Membership source (v71 #1)
// ---------------------------------------------------------------------------
// getCurrentUser() now returns the user's ACTIVE memberships alongside the
// user row (lib/session.js embeds them in the one session lookup), so
// these checks no longer cost a group_members request each. If a user
// object ever arrives without `memberships` (anything that builds a user
// some other way), fall back to querying, so behavior never silently
// changes.
async function activeMemberships(user) {
  if (Array.isArray(user.memberships)) return user.memberships;

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id, role, groups(hidden, hide_restricts_access, archived_at)")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (error) return [];
  return (data || []).map((m) => ({
    group_id: m.group_id,
    role: m.role,
    hidden: Boolean(m.groups?.hidden),
    hide_restricts_access: Boolean(m.groups?.hide_restricts_access),
    archived: Boolean(m.groups?.archived_at),
  }));
}

// This user's own active membership row for one group (or null). Exposed
// so routes that need "am I in this group / what's my role" read the
// same data instead of querying group_members themselves.
export async function getMyMembership(user, groupId) {
  if (!user || !groupId) return null;
  const list = await activeMemberships(user);
  return list.find((m) => m.group_id === groupId) || null;
}

// Church Admin always passes, regardless of group. Otherwise, checks
// whether this user has an ACTIVE 'leader' row for this exact group.
// This is the one check every group-scoped write route must run — never
// infer authority from what the client claims or from the UI state.
//
// Also denies non-admins when the group is hidden AND
// hide_restricts_access is true (see migration_023) -- that combination
// means the ministry is meant to be effectively disabled for everyone,
// leaders included, until an admin un-hides it or turns the restriction
// off. A hidden group with hide_restricts_access = false (the default)
// does NOT deny here -- that combination only removes it from
// discovery, existing leaders/members keep working access.
export async function canManageGroup(user, groupId) {
  if (!user) return false;
  if (user.is_church_admin) return true;

  const m = await getMyMembership(user, groupId);
  if (!m || m.role !== "leader") return false;
  if (m.hidden && m.hide_restricts_access) return false;
  if (m.archived) return false; // v71 #24: an archived ministry is offline for non-admins
  return true;
}

// Broader check: is this user an active member (leader OR member) of this
// group at all? Used for read access to group-scoped content, and for
// things like "can view the roster."
//
// Same hide_restricts_access denial as canManageGroup above, for the
// same reason: a fully-restricted hidden group blocks everyone but an
// admin, not just new discovery.
export async function isActiveGroupMember(user, groupId) {
  if (!user) return false;
  if (user.is_church_admin) return true;

  const m = await getMyMembership(user, groupId);
  if (!m) return false;
  if (m.hidden && m.hide_restricts_access) return false;
  if (m.archived) return false; // v71 #24
  return true;
}

// Is this user a leader of ANY group (or a Church Admin)? Used for
// church-wide leader-only content (migration_024) -- a "leaders"
// audience post on global_news should be visible to every ministry
// leader across the whole church, not scoped to one group the way
// canManageGroup/isActiveGroupMember are. (Unchanged rule: the hidden
// flags don't affect this one.)
export async function isAnyGroupLeader(user) {
  if (!user) return false;
  if (user.is_church_admin) return true;

  const list = await activeMemberships(user);
  return list.some((m) => m.role === "leader");
}

// v71 #2 -- binds a child row to its parent. Returns true only if the row
// `id` in `table` exists AND its `column` equals `parentId`. Every route
// that takes a parent ID and a child ID from the URL (group + event,
// program + song, ...) must call this, otherwise a manager of ministry A
// could act on ministry B's rows by pairing A's ID with B's child ID.
export async function assertInGroup(table, id, parentId, column = "group_id") {
  if (!id || !parentId) return false;
  const supabase = supabaseServer();
  const { data, error } = await supabase.from(table).select("id").eq("id", id).eq(column, parentId).maybeSingle();
  if (error || !data) return false;
  return true;
}
