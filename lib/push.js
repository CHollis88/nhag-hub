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
export async function sendToUsers(userIds, payload) {
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

// Church-wide leaders channel (migration_024): every active leader
// across EVERY group, plus Church Admins -- distinct from
// notifyGroupLeaders, which is scoped to one group's own leaders. Uses
// the same global_notification_prefs opt-out as notifyGlobal, since
// this is still fundamentally a church-wide notification, just
// filtered to a subset of recipients by role rather than by group.
export async function notifyAllLeaders(payload) {
  const supabase = supabaseServer();
  const { data: leaderRows } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("role", "leader")
    .eq("status", "active");
  const { data: admins } = await supabase.from("users").select("id").eq("is_church_admin", true);

  const recipientSet = new Set([
    ...(leaderRows || []).map((r) => r.user_id),
    ...(admins || []).map((a) => a.id),
  ]);

  const { data: optedOut } = await supabase
    .from("global_notification_prefs")
    .select("user_id")
    .eq("enabled", false);
  const optedOutIds = new Set((optedOut || []).map((r) => r.user_id));

  const recipientIds = [...recipientSet].filter((id) => !optedOutIds.has(id));
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

// Another targeted variant: sends to every LEADER of one specific
// group (not the whole membership) -- for content that's meaningful to
// that group's leadership as a whole, like a 'leader'-kind News post
// (migration_024). Same opt-out and group-name-prefix handling as
// notifyGroup/notifyGroupMember, just a different recipient set.
export async function notifyGroupLeaders(groupId, payload) {
  const supabase = supabaseServer();
  const { data: leaders } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("role", "leader")
    .eq("status", "active");

  const leaderIds = (leaders || []).map((m) => m.user_id);
  if (!leaderIds.length) return;

  const { data: optedOut } = await supabase
    .from("group_notification_prefs")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("enabled", false);

  const optedOutIds = new Set((optedOut || []).map((r) => r.user_id));
  const recipientIds = leaderIds.filter((id) => !optedOutIds.has(id));
  const scopedPayload = await withGroupPrefix(supabase, groupId, payload);
  await sendToUsers(recipientIds, scopedPayload);
}

// Direct Messages (migration_026): notifies every OTHER participant in a
// thread besides the sender. A muted participant is skipped entirely here
// -- no push, no in-app notification-bell entry -- per Cam's decision
// that muting silences alerts but must NOT hide the thread's own unread
// count, which is computed separately (message timestamps vs
// last_read_at) and is unaffected by whether this function ran for them.
export async function notifyDmThread(threadId, senderId, payload) {
  const supabase = supabaseServer();
  const { data: participants } = await supabase
    .from("group_dm_participants")
    .select("user_id, muted")
    .eq("thread_id", threadId);

  const recipientIds = (participants || [])
    .filter((p) => p.user_id !== senderId && !p.muted)
    .map((p) => p.user_id);
  if (!recipientIds.length) return;

  await sendToUsers(recipientIds, payload);
}

// Group Chat (migration_027): notifies everyone with access to that
// channel -- all active members for 'members', that group's own active
// leaders for 'leaders' -- except the sender and anyone who's muted that
// group+channel. Same mute semantics as notifyDmThread above.
export async function notifyGroupChatChannel(groupId, channel, senderId, payload) {
  const supabase = supabaseServer();

  const membersQuery = supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("status", "active");
  if (channel === "leaders") membersQuery.eq("role", "leader");

  const { data: members } = await membersQuery;
  const memberIds = (members || []).map((m) => m.user_id).filter((id) => id !== senderId);
  if (!memberIds.length) return;

  const { data: muted } = await supabase
    .from("group_chat_reads")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("channel", channel)
    .eq("muted", true);
  const mutedIds = new Set((muted || []).map((r) => r.user_id));

  const recipientIds = memberIds.filter((id) => !mutedIds.has(id));
  if (!recipientIds.length) return;

  const scopedPayload = await withGroupPrefix(supabase, groupId, payload);
  await sendToUsers(recipientIds, scopedPayload);
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
