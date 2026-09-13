import webpush from "web-push";
import { supabaseServer } from "@/lib/supabaseServer";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set — run `npm run generate-vapid`.");
  }
  webpush.setVapidDetails("mailto:admin@example.com", publicKey, privateKey);
  configured = true;
}

// Sends a push payload to every subscribed device for the given user IDs.
// Failures for one dead/expired subscription don't block the others —
// each send is independent, and a subscription that comes back
// permanently invalid (410 Gone) gets cleaned up automatically.
async function sendToUsers(userIds, payload) {
  if (!userIds.length) return;
  ensureConfigured();

  const supabase = supabaseServer();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .in("user_id", userIds);

  if (error || !subs?.length) return;

  await Promise.all(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", row.id);
        }
        // Other errors (network blip, etc.) are swallowed — a single
        // failed push should never break the request that triggered it.
      }
    })
  );
}

// Global scope: every user who hasn't explicitly turned church-wide
// notifications off. No row in global_notification_prefs means enabled
// (opt-out model) — see migration_007_push_notifications.sql.
export async function notifyGlobal(payload) {
  const supabase = supabaseServer();
  const { data: allUsers } = await supabase.from("users").select("id");
  const { data: optedOut } = await supabase
    .from("global_notification_prefs")
    .select("user_id")
    .eq("enabled", false);

  const optedOutIds = new Set((optedOut || []).map((r) => r.user_id));
  const recipientIds = (allUsers || []).map((u) => u.id).filter((id) => !optedOutIds.has(id));
  await sendToUsers(recipientIds, payload);
}

// Group scope: active members of the group who haven't turned off
// notifications for that specific group. Same opt-out default.
export async function notifyGroup(groupId, payload) {
  const supabase = supabaseServer();
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("status", "active");

  const memberIds = (members || []).map((m) => m.user_id);
  if (!memberIds.length) return;

  const { data: optedOut } = await supabase
    .from("group_notification_prefs")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("enabled", false);

  const optedOutIds = new Set((optedOut || []).map((r) => r.user_id));
  const recipientIds = memberIds.filter((id) => !optedOutIds.has(id));
  await sendToUsers(recipientIds, payload);
}
