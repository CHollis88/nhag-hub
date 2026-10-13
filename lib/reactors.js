import { authorName } from "@/lib/authorName";

// v71_16 -- who reacted? Given reaction rows ({ user_id, ... }), looks up each
// person's display name in ONE query and returns a Map(user_id -> name).
// Someone whose account was deleted shows as "Former member".
export async function reactorNames(supabase, rows) {
  const ids = [...new Set((rows || []).map((r) => r.user_id).filter(Boolean))];
  const names = new Map();
  if (!ids.length) return names;
  const { data } = await supabase.from("users").select("id, display_name").in("id", ids);
  for (const u of data || []) names.set(u.id, authorName(u));
  return names;
}

export function nameFor(names, userId) {
  return names.get(userId) || authorName(null);
}
