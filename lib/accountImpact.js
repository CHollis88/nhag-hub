// v71 -- what deleting an account would remove and what would stay,
// counted by the SERVER at the moment an admin asks, so the warning is exact.
//
// GOES WITH THE PERSON (private to them, or only meaningful to them):
//   memberships, direct-message conversations and every message in them,
//   journal entries, Bible notes and highlights, event RSVPs, reading progress.
// STAYS (shared content other people rely on; the author just becomes blank,
// shown as "Former member"): group chat messages, news posts, events, prayer
// requests, sermons.

const WILL_BE_DELETED = [
  ["memberships", "group_members", "user_id"],
  ["conversations", "group_dm_participants", "user_id"],
  ["direct_messages", "group_dm_messages", "sender_id"],
  ["journal_entries", "journal_entries", "user_id"],
  ["bible_notes", "bible_notes", "user_id"],
  ["bible_highlights", "bible_highlights", "user_id"],
  ["event_rsvps", "group_event_rsvps", "user_id"],
  ["church_event_rsvps", "global_event_rsvps", "user_id"],
];

const WILL_STAY = [
  ["chat_messages", "group_chat_messages", "sender_id"],
  ["news_posts", "group_news", "created_by"],
  ["church_news_posts", "global_news", "created_by"],
  ["events", "group_events", "created_by"],
  ["prayer_requests", "group_prayer", "created_by"],
  ["sermons", "sermons", "created_by"],
];

async function countAll(supabase, list, userId) {
  const results = await Promise.all(
    list.map(async ([key, table, column]) => {
      const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq(column, userId);
      // A count that couldn't be taken is reported as unknown (null), never
      // as 0 -- "0" would tell an admin nothing is at stake.
      return [key, error ? null : count || 0];
    })
  );
  return Object.fromEntries(results);
}

export async function accountImpact(supabase, userId) {
  const [deleted, kept] = await Promise.all([countAll(supabase, WILL_BE_DELETED, userId), countAll(supabase, WILL_STAY, userId)]);
  return { will_be_deleted: deleted, will_stay: kept };
}

// Deleting an account is only safe once migration_036 has been run. Until then
// the database still deletes a person's GROUP CHAT MESSAGES along with them
// (that foreign key only becomes "keep the message, blank the author" in 036),
// which would silently break the promise the confirmation makes -- "chat messages
// stay as Former member". Two other authored things would make the database
// refuse outright, but the chat messages would simply vanish. So account deletion
// checks for a column that migration_036 adds, and refuses if it isn't there.
export const NEEDS_MIGRATION_036 =
  "Deleting accounts needs a database update that hasn't been applied yet (v71 migration 036). Nothing was deleted.";

export async function accountDeletionReady(supabase) {
  const { error } = await supabase.from("users").select("admin_notifications_enabled").limit(1);
  return !error;
}
