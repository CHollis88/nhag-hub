import { supabaseServer } from "@/lib/supabaseServer";

// Church Admin always passes, regardless of group. Otherwise, checks
// whether this user has an ACTIVE 'leader' row for this exact group.
// This is the one check every group-scoped write route must run — never
// infer authority from what the client claims or from the UI state.
export async function canManageGroup(user, groupId) {
  if (!user) return false;
  if (user.is_church_admin) return true;

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .eq("role", "leader")
    .eq("status", "active")
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

// Broader check: is this user an active member (leader OR member) of this
// group at all? Used for read access to group-scoped content in later
// phases, and for things like "can view the roster."
export async function isActiveGroupMember(user, groupId) {
  if (!user) return false;
  if (user.is_church_admin) return true;

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}
