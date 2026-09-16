import { supabaseServer } from "@/lib/supabaseServer";

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

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_members")
    .select("id, groups(hidden, hide_restricts_access)")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .eq("role", "leader")
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return false;
  if (data.groups?.hidden && data.groups?.hide_restricts_access) return false;
  return true;
}

// Broader check: is this user an active member (leader OR member) of this
// group at all? Used for read access to group-scoped content in later
// phases, and for things like "can view the roster."
//
// Same hide_restricts_access denial as canManageGroup above, for the
// same reason: a fully-restricted hidden group blocks everyone but an
// admin, not just new discovery.
export async function isActiveGroupMember(user, groupId) {
  if (!user) return false;
  if (user.is_church_admin) return true;

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_members")
    .select("id, groups(hidden, hide_restricts_access)")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return false;
  if (data.groups?.hidden && data.groups?.hide_restricts_access) return false;
  return true;
}

// Is this user a leader of ANY group (or a Church Admin)? Used for
// church-wide leader-only content (migration_024) -- a "leaders"
// audience post on global_news should be visible to every ministry
// leader across the whole church, not scoped to one group the way
// canManageGroup/isActiveGroupMember are.
export async function isAnyGroupLeader(user) {
  if (!user) return false;
  if (user.is_church_admin) return true;

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "leader")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}
