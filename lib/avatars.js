// Profile photos (v71.29). A person's photo URL lives in users.avatar_url
// (migration_040). It's looked up SEPARATELY from the main queries, and any
// failure (e.g. the migration hasn't been run yet) just means no photos --
// so a missing column can never break sign-in, rosters or news.
export async function avatarsFor(supabase, userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;
  try {
    const { data, error } = await supabase.from("users").select("id, avatar_url").in("id", ids);
    if (error) return map;
    for (const u of data || []) if (u.avatar_url) map.set(u.id, u.avatar_url);
  } catch {
    // no photos
  }
  return map;
}

// Adds avatar_url to each row's nested `users` object (rows like
// { user_id, users: { display_name } } or { created_by, users: {...} }).
export async function withAvatars(supabase, rows, idOf = (r) => r.user_id ?? r.users?.id ?? r.created_by) {
  const list = rows || [];
  const map = await avatarsFor(supabase, list.map(idOf));
  if (!map.size) return list;
  return list.map((r) => {
    const url = map.get(idOf(r));
    return url && r.users ? { ...r, users: { ...r.users, avatar_url: url } } : r;
  });
}

// "https://<project>.supabase.co/storage/v1/object/public/avatars/<path>"
// -> "<path>" (to delete an old photo when it's replaced).
export function avatarPathFromUrl(url) {
  const m = String(url || "").match(/\/object\/public\/avatars\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
