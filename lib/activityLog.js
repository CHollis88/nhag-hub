import { supabaseServer } from "@/lib/supabaseServer";

// Fire-and-forget, same pattern as the push-notification helpers -- a
// logging failure should never break the action it's logging. Callers
// don't await this in a way that blocks the response.
export async function logActivity(actorId, action, details) {
  try {
    const supabase = supabaseServer();
    await supabase.from("admin_activity_log").insert({ actor_id: actorId, action, details: details || null });
  } catch {
    // Deliberately swallowed -- logging is best-effort, never load-bearing.
  }
}
