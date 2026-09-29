import { supabaseServer } from "@/lib/supabaseServer";

// Fire-and-forget, same pattern as the push-notification helpers -- a
// logging failure should never break the action it's logging. Callers
// don't await this in a way that blocks the response.
//
// v71 #26: `details` is now a complete, readable sentence that includes who
// did it ("Cam approved Taylor's request to join Choir"); `meta` (optional)
// holds the raw structured details, shown when a line is expanded.
export async function logActivity(actorId, action, details, meta = null) {
  try {
    const supabase = supabaseServer();
    const row = { actor_id: actorId, action, details: details || null };
    if (meta) row.meta = meta;
    let { error } = await supabase.from("admin_activity_log").insert(row);
    // Before migration_035 there is no `meta` column: keep logging without it.
    if (error && meta) {
      delete row.meta;
      await supabase.from("admin_activity_log").insert(row);
    }
  } catch {
    // Deliberately swallowed -- logging is best-effort, never load-bearing.
  }
}
