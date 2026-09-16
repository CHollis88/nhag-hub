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

// Sends a push payload to every subscribed device for the given user IDs,
// AND writes a persistent in-app notification for every one of them --
// regardless of whether they have push enabled on any device. Push is
// ephemeral (miss it and it's gone); the in-app record is what the
// Notifications screen actually shows. Failures for one dead/expired
// push subscription don't block the others -- each send is independent,
// and a subscription that comes back permanently invalid (410 Gone) gets
// cleaned up automatically.
async function sendToUsers(userIds, payload) {
  if (!userIds.length) return;

  const supabase = supabaseServer();

  // In-app record first -- this should exist even for someone who never
  // enabled push at all, so it's never gated on subscription status.
  await supabase.from("notifications").insert(
    userIds.map((userId) => ({
      user_id: userId,
      title: payload.title,
      body: payload.body || null,
      url: payload.url || null,
    }))
  );

  ensureConfigured();

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

// Shared by both group-notification functions below: fetch the group's
// name once and prefix it onto a payload's title, so a notification is
// always attributable to the specific ministry group it came from.
async function withGroupPrefix(supabase, groupId, payload) {
  const { data: group } = await supabase.from("groups").select("name").eq("id", groupId).single();
  return group?.name ? { ...payload, title: `${group.name}: ${payload.title}` } : payload;
}

// Group scope: active members of the group who haven't turned off
// notifications for that specific group. Same opt-out default.
//
// Every notification in this scope must be clearly attributable to the
// specific ministry group it came from -- a "New Event" or "New Prayer
// Request" push is ambiguous the moment someone's in more than one
// group, since it looks identical whether it's from a Bible study,
// Choir, or any other ministry group. So the group's name is prefixed
// onto the title here, once, centrally -- every current and future
// notifyGroup() call gets this automatically, instead of relying on each
// call site to remember to add it. (notifyGlobal(), by contrast, is for
// genuinely church-wide notices, so those stay unprefixed -- "Church
// Event", "Church News" are already correctly scoped as coming from NHAG
// as a whole, not from any one group.)
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
  const scopedPayload = await withGroupPrefix(supabase, groupId, payload);
  await sendToUsers(recipientIds, scopedPayload);
}

// Targeted variant of notifyGroup: sends to exactly one member of a
// group, rather than the whole group. For notifications that are only
// meaningful to one specific person -- e.g. "someone is praying for
// YOUR request" or "someone replied to YOUR post" shouldn't go to every
// member of the group, just the person the content is actually about.
// Still respects that member's own group notification opt-out (same
// preference table notifyGroup checks), and still gets the same
// group-name-prefixed title for consistent attribution.
export async function notifyGroupMember(groupId, userId, payload) {
  const supabase = supabaseServer();

  const { data: optedOut } = await supabase
    .from("group_notification_prefs")
    .select("enabled")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (optedOut?.enabled === false) return;

  const scopedPayload = await withGroupPrefix(supabase, groupId, payload);
  await sendToUsers([userId], scopedPayload);
}

// Every Church Admin -- used for moments that specifically need admin
// attention (a join request awaiting approval, a promotion request
// awaiting review), regardless of which group it's for. Not subject to
// the global/group notification-preference toggles, since these are
// admin-duty notifications, not general church content.
export async function notifyAdmins(payload) {
  const supabase = supabaseServer();
  const { data: admins } = await supabase.from("users").select("id").eq("is_church_admin", true);
  const adminIds = (admins || []).map((a) => a.id);
  await sendToUsers(adminIds, payload);
}
