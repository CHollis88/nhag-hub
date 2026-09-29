"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Wrench, Search } from "lucide-react";
import { SkeletonRowList } from "./Skeleton";
import { PATCH_NOTES } from "@/lib/patchNotes";
import AdminNeedsAttention from "./AdminNeedsAttention";
import Switch from "./Switch";
import { useAdminAction } from "./useAdminAction";
import Modal from "./Modal";
import { useConfirm } from "./ConfirmDialog";
import { useAction } from "./useAction";
import { requestJson } from "@/lib/request";

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}


// Opened on demand from Settings, rather than always rendered inline on
// Home -- per the project's decision, admin-only controls shouldn't
// permanently take up space on the screen everyone sees every day.
export default function AdminToolboxView({ onClose, onOpenGroup, onAttentionChanged, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [userQuery, setUserQuery] = useState("");
  const [activityLog, setActivityLog] = useState(null);
  const [logHasMore, setLogHasMore] = useState(false);
  const [logLoadingMore, setLogLoadingMore] = useState(false);
  const [logExpandedId, setLogExpandedId] = useState(null);
  const [logOpen, setLogOpen] = useState(false);

  const confirm = useConfirm();
  const run = useAction();
  const runAdmin = useAdminAction(); // asks for the PIN again where the server requires it

  const loadUsers = useCallback(async () => {
    try {
      const data = await requestJson("/api/admin/users");
      setUsers(data.users);
    } catch {
      // Leaves whatever is already showing.
    }
  }, []);

  const filteredUsers = useMemo(() => {
    if (!userQuery.trim()) return users;
    const q = userQuery.toLowerCase();
    return users.filter(
      (u) => u.display_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
    );
  }, [users, userQuery]);

  const loadActivityLog = useCallback(async () => {
    try {
      const data = await requestJson("/api/admin/activity-log");
      setActivityLog(data.entries);
      setLogHasMore(Boolean(data.has_more));
    } catch {
      setActivityLog([]);
    }
  }, []);

  // Older entries, appended below what's shown (#44: never load the whole log).
  const loadMoreLog = async () => {
    const last = activityLog?.[activityLog.length - 1];
    if (!last || logLoadingMore) return;
    setLogLoadingMore(true);
    const { ok, data } = await run(() => requestJson(`/api/admin/activity-log?before=${encodeURIComponent(last.created_at)}`));
    setLogLoadingMore(false);
    if (!ok) return;
    setActivityLog((prev) => [...prev, ...data.entries]);
    setLogHasMore(Boolean(data.has_more));
  };

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (logOpen && activityLog === null) loadActivityLog();
  }, [logOpen, activityLog, loadActivityLog]);

  const [pendingUserId, setPendingUserId] = useState(null);

  // v71 -- turn another admin's admin-duty notifications on/off (for an admin
  // who holds the role for the authority but shouldn't get the alerts). Only
  // affects notifications; the list and badge still work for them.
  const [pendingNotifId, setPendingNotifId] = useState(null);
  const toggleAdminNotifications = async (targetUser) => {
    if (pendingNotifId) return;
    const next = !targetUser.admin_notifications_enabled;
    setPendingNotifId(targetUser.id);
    const { ok } = await run(
      () => requestJson(`/api/admin/users/${targetUser.id}/notifications`, { method: "PATCH", body: { enabled: next } }),
      { success: `${targetUser.display_name}'s admin notifications are ${next ? "on" : "off"}` }
    );
    setPendingNotifId(null);
    if (ok) loadUsers();
  };

  // v71 -- permanently delete an ACCOUNT. The warning lists, from the
  // server's own counts, what goes with the person and what stays; then it
  // asks for the PIN. (Admins can't be deleted directly: remove their admin
  // access first.)
  const deleteAccount = async (targetUser) => {
    const { ok: gotCounts, data: impact } = await run(() => requestJson(`/api/admin/users/${targetUser.id}/impact`));
    if (!gotCounts) return;
    // "3 journal entries", "1 sermon": explicit singular/plural, zeros left out.
    const list = (counts, labels) =>
      labels
        .filter(([key]) => counts[key] > 0)
        .map(([key, one, many]) => `${counts[key]} ${counts[key] === 1 ? one : many}`)
        .join(", ");
    const goes = list(impact.will_be_deleted, [
      ["direct_messages", "private message", "private messages"],
      ["conversations", "private conversation", "private conversations"],
      ["journal_entries", "journal entry", "journal entries"],
      ["bible_notes", "Bible note", "Bible notes"],
      ["bible_highlights", "highlight", "highlights"],
      ["memberships", "ministry membership", "ministry memberships"],
    ]);
    const stays = list(impact.will_stay, [
      ["chat_messages", "chat message", "chat messages"],
      ["news_posts", "news post", "news posts"],
      ["events", "event", "events"],
      ["prayer_requests", "prayer request", "prayer requests"],
      ["sermons", "sermon", "sermons"],
    ]);
    const yes = await confirm({
      title: `Permanently delete ${targetUser.display_name}'s account?`,
      message:
        `This cannot be undone. Deleted with them: ${goes || "nothing else"}. ` +
        `Kept, shown as "Former member": ${stays || "nothing"}. ` +
        `They're signed out everywhere right away, and the same email can register again as a brand-new account.`,
      confirmLabel: "Continue to PIN",
    });
    if (!yes) return;
    const { ok } = await runAdmin(() => requestJson(`/api/admin/users/${targetUser.id}`, { method: "DELETE" }), {
      success: `${targetUser.display_name}'s account was deleted`,
      pinTitle: `Delete ${targetUser.display_name}'s account`,
      pinMessage: "This can't be undone. Enter your PIN to confirm.",
      pinLabel: "Delete account",
    });
    if (ok) loadUsers();
  };

  const toggleAdmin = async (targetUser) => {
    if (pendingUserId) return;
    setPendingUserId(targetUser.id);
    // v71 #21: changing who has power asks for your PIN again.
    const { ok } = await runAdmin(
      () => requestJson(`/api/admin/users/${targetUser.id}`, { method: "PATCH", body: { is_church_admin: !targetUser.is_church_admin } }),
      {
        success: targetUser.is_church_admin ? `${targetUser.display_name} is no longer an admin` : `${targetUser.display_name} is now an admin`,
        pinTitle: targetUser.is_church_admin ? `Remove ${targetUser.display_name} as admin` : `Make ${targetUser.display_name} an admin`,
        pinMessage: targetUser.is_church_admin
          ? "They'll lose every admin ability. Enter your PIN to confirm."
          : "Admins can manage every ministry and everyone's account. Enter your PIN to confirm.",
        pinLabel: targetUser.is_church_admin ? "Remove admin" : "Make admin",
      }
    );
    if (ok) await loadUsers();
    setPendingUserId(null);
  };

  // No-email account creation -- for a member (e.g. a disabled student)
  // who can't manage email but can still sign in with a username + PIN
  // on their own device. Bypasses the magic-link flow entirely; the
  // server generates a placeholder address just to satisfy the DB's
  // not-null email constraint, and it's never used for anything.
  const [newAcctUsername, setNewAcctUsername] = useState("");
  const [newAcctDisplayName, setNewAcctDisplayName] = useState("");
  const [newAcctPin, setNewAcctPin] = useState("");
  const [acctMessage, setAcctMessage] = useState("");
  const [announceMessage, setAnnounceMessage] = useState("");
  const [announcing, setAnnouncing] = useState(false);

  const announceUpdate = async () => {
    const latest = PATCH_NOTES[0];
    if (!latest) return;
    if (announcing) return;
    const yes = await confirm({
      title: "Notify everyone about this update?",
      message: `This sends a push notification to EVERYONE announcing "${latest.title}" and asking them to close and reopen the app. It can't be undone.`,
      confirmLabel: "Send to everyone",
    });
    if (!yes) return;
    setAnnouncing(true);
    setAnnounceMessage("");
    try {
      await requestJson("/api/admin/announce-update", { method: "POST" });
      setAnnounceMessage("Sent.");
    } catch (err) {
      setAnnounceMessage(err.message);
    } finally {
      setAnnouncing(false);
    }
  };

  const createNoEmailAccount = async (e) => {
    e.preventDefault();
    setAcctMessage("");
    // Everything typed (including the PIN) stays in the form if this fails.
    let data;
    try {
      data = await requestJson("/api/admin/users", {
        method: "POST",
        body: { username: newAcctUsername, display_name: newAcctDisplayName, pin: newAcctPin },
      });
    } catch (err) {
      setAcctMessage(err.message);
      return;
    }
    setAcctMessage(`Account created for ${data.user.display_name}. Sign them in with username "${data.user.username}" and the PIN you set.`);
    setNewAcctUsername("");
    setNewAcctDisplayName("");
    setNewAcctPin("");
    loadUsers();
  };

  // Per-user ministry blocking -- separate from global ministry hiding
  // above. Opens a panel for one user showing every ministry with a
  // checkbox for "blocked for this person"; checking it also removes
  // their membership if they're currently in it (server-side).
  const [manageUser, setManageUser] = useState(null);
  const [hiddenGroupIds, setHiddenGroupIds] = useState([]);

  const openUserMinistryPanel = async (targetUser) => {
    setManageUser(targetUser);
    setHiddenGroupIds([]);
    const { ok, data } = await run(() => requestJson(`/api/admin/users/${targetUser.id}/hidden-groups`));
    if (ok) setHiddenGroupIds(data.hidden_group_ids);
  };

  const toggleUserMinistryBlock = async (groupId, currentlyBlocked) => {
    // The checkbox only changes once the server has accepted it -- before,
    // it flipped even when the request failed, so it could show a block that
    // was never applied (and that would not have removed their membership).
    const { ok } = await run(() =>
      currentlyBlocked
        ? requestJson(`/api/admin/users/${manageUser.id}/hidden-groups/${groupId}`, { method: "DELETE" })
        : requestJson(`/api/admin/users/${manageUser.id}/hidden-groups`, { method: "POST", body: { group_id: groupId } })
    );
    if (!ok) return;
    setHiddenGroupIds((prev) => (currentlyBlocked ? prev.filter((id) => id !== groupId) : [...prev, groupId]));
  };

  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("#8B1E2F");
  const [message, setMessage] = useState("");
  const [pendingCounts, setPendingCounts] = useState({});

  const loadGroups = useCallback(async () => {
    try {
      const data = await requestJson("/api/groups", { cache: "no-store" });
      setGroups(data.groups);
    } catch {
      // Keeps what's already showing.
    }
  }, []);

  const loadPendingCounts = useCallback(async (groupList) => {
    const results = await Promise.all(
      groupList.map(async (g) => {
        try {
          const data = await requestJson(`/api/groups/${g.id}/members`);
          return [g.id, data.pending?.length || 0];
        } catch {
          return [g.id, 0];
        }
      })
    );
    setPendingCounts(Object.fromEntries(results));
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (groups.length) loadPendingCounts(groups);
  }, [groups, loadPendingCounts]);

  const createGroup = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      await requestJson("/api/groups", { method: "POST", body: { name: newGroupName, type: newGroupType, tile_color: newGroupColor } });
    } catch (err) {
      setMessage(err.message); // the form keeps what was typed
      return;
    }
    setNewGroupName("");
    setNewGroupType("");
    loadGroups();
  };

  const manage = (group) => {
    onClose();
    onOpenGroup(group.id, group.name, "admin", group.features);
  };

  // v71 #24 -- taking a ministry away has two very different forms:
  //   Archive: hidden from members and the directory, EVERYTHING KEPT,
  //            restorable any time. No PIN -- nothing is lost.
  //   Delete permanently: gone for good. The warning lists what will be
  //            destroyed (counted by the server just now), and it asks for
  //            your PIN.
  const archiveGroup = async (group) => {
    const yes = await confirm({
      title: `Archive "${group.name}"?`,
      message:
        "Members won't see it anywhere — Home, the directory or the calendar. Nothing is deleted: its members, posts, songs and files are all kept, and you can restore it whenever you like.",
      confirmLabel: "Archive ministry",
      destructive: false,
    });
    if (!yes) return;
    setMessage("");
    const { ok } = await run(() => requestJson(`/api/groups/${group.id}`, { method: "PATCH", body: { archived: true } }), {
      success: `"${group.name}" archived`,
    });
    if (ok) loadGroups();
  };

  const restoreGroup = async (group) => {
    setMessage("");
    const { ok } = await run(() => requestJson(`/api/groups/${group.id}`, { method: "PATCH", body: { archived: false } }), {
      success: `"${group.name}" restored`,
    });
    if (ok) loadGroups();
  };

  const deleteGroupPermanently = async (group) => {
    setMessage("");
    // Counted by the server at this moment, so the warning is exact.
    const { ok: gotCounts, data: impact } = await run(() => requestJson(`/api/groups/${group.id}/impact`));
    if (!gotCounts) return;
    const c = impact.counts || {};
    const parts = [
      [c.members, "member"],
      [c.pending_requests, "pending join request"],
      [c.news_posts, "news post"],
      [c.events, "event"],
      [c.prayer_requests, "prayer request"],
      [c.songs, "song"],
      [c.setlists, "setlist"],
      [c.programs, "program"],
      [c.curriculum_files, "curriculum file"],
      [c.chat_messages, "chat message"],
      [c.conversations, "private conversation"],
    ]
      .filter(([n]) => n > 0)
      .map(([n, word]) => `${n} ${word}${n === 1 ? "" : "s"}`);
    const yes = await confirm({
      title: `Permanently delete "${group.name}"?`,
      message: `This cannot be undone. It will destroy ${parts.length ? parts.join(", ") : "everything in it"}${
        group.archived_at ? "" : ". If you only want it out of sight, Archive it instead — that keeps everything"
      }.`,
      confirmLabel: "Continue to PIN",
    });
    if (!yes) return;
    const { ok } = await runAdmin(() => requestJson(`/api/groups/${group.id}`, { method: "DELETE" }), {
      success: `"${group.name}" permanently deleted`,
      pinTitle: `Delete "${group.name}" permanently`,
      pinMessage: "This can't be undone. Enter your PIN to confirm.",
      pinLabel: "Delete permanently",
    });
    if (ok) loadGroups();
  };

  const toggleHidden = async (group) => {
    setMessage("");
    const { ok } = await run(() => requestJson(`/api/groups/${group.id}`, { method: "PATCH", body: { hidden: !group.hidden } }));
    if (ok) loadGroups();
  };

  const toggleRestrictsAccess = async (group) => {
    setMessage("");
    const { ok } = await run(() =>
      requestJson(`/api/groups/${group.id}`, { method: "PATCH", body: { hide_restricts_access: !group.hide_restricts_access } })
    );
    if (ok) loadGroups();
  };

  return (
    <Modal
      title={
        <>
          <Wrench size={18} className="text-inkfaint flex-shrink-0" aria-hidden="true" /> Admin Toolbox
        </>
      }
      closeLabel="Close Admin Toolbox"
      headingClassName="font-serif text-xl text-ink m-0 flex items-center gap-2 min-w-0 truncate"
      onClose={onClose}
      z={60}
      maxHeight="85vh"
    >
        <p className="text-xs text-sage font-semibold mt-0 mb-4">Admin privileges on</p>

        <AdminNeedsAttention onChanged={onAttentionChanged} />

        <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Create a ministry</p>
        <form onSubmit={createGroup} className="sp-card mb-6">
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Ministry name (e.g. Wednesday Night, Security Team)"
            required
            className="sp-input mb-2"
          />
          <input
            value={newGroupType}
            onChange={(e) => setNewGroupType(e.target.value)}
            placeholder="Type / category label (optional, just for display)"
            className="sp-input mb-3"
          />
          <label className="flex items-center gap-2 mb-3 text-sm text-inksoft">
            Tile color:
            <input
              type="color"
              value={newGroupColor}
              onChange={(e) => setNewGroupColor(e.target.value)}
              className="w-10 h-8 rounded border border-line"
            />
          </label>
          <button type="submit" className="sp-btn-primary">Create</button>
        </form>

        <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Set up an account without email</p>
        <p className="text-xs text-inkfaint mb-2">
          For someone who can't manage an email of their own but can still sign in with a username and PIN
          on their own device — no magic link involved at all.
        </p>
        <form onSubmit={createNoEmailAccount} className="sp-card mb-6">
          <input
            value={newAcctDisplayName}
            onChange={(e) => setNewAcctDisplayName(e.target.value)}
            placeholder="Full name"
            required
            className="sp-input mb-2"
          />
          <input
            value={newAcctUsername}
            onChange={(e) => setNewAcctUsername(e.target.value)}
            placeholder="Username (lowercase, numbers, underscores)"
            required
            className="sp-input mb-2"
          />
          <input
            value={newAcctPin}
            onChange={(e) => setNewAcctPin(e.target.value)}
            placeholder="PIN (4–8 digits)"
            inputMode="numeric"
            required
            className="sp-input mb-2"
          />
          <button type="submit" className="sp-btn-primary">Create Account</button>
          {acctMessage && <p className="text-sm text-inksoft mt-2">{acctMessage}</p>}
        </form>

        <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Announce an update</p>
        <p className="text-xs text-inkfaint mb-2">
          Sends a push notification to everyone letting them know a new build is live, using the
          newest entry in What's New (Settings) — {PATCH_NOTES[0]?.title || "no entry yet"}. Tell people to fully
          close and reopen the app afterward so it actually picks up the update.
        </p>
        <div className="sp-card mb-6">
          <button onClick={announceUpdate} disabled={announcing || !PATCH_NOTES[0]} className="sp-btn-primary disabled:opacity-50">
            {announcing ? "Sending..." : "Announce Update to Everyone"}
          </button>
          {announceMessage && <p className="text-sm text-inksoft mt-2">{announceMessage}</p>}
        </div>

        <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Manage ministries</p>
        <div className="space-y-2">
          {groups.filter((g) => !g.archived_at).map((g) => (
            <div key={g.id} className="sp-card">
              <div className="flex justify-between items-center">
                <span className="text-sm text-ink">
                  {g.name} {g.type && <span className="text-inkfaint">({g.type})</span>}
                  {pendingCounts[g.id] > 0 && (
                    <span className="ml-2 text-xs bg-accent text-white rounded-full px-2 py-0.5">
                      {pendingCounts[g.id]} pending
                    </span>
                  )}
                  {g.hidden && (
                    <span className="ml-2 text-xs bg-inkfaint/20 text-inkfaint rounded-full px-2 py-0.5">
                      Hidden{g.hide_restricts_access ? " · access restricted" : ""}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => manage(g)} className="sp-btn-secondary text-xs py-1.5 px-3">
                    Manage
                  </button>
                  <button onClick={() => archiveGroup(g)} className="text-xs text-inksoft underline" aria-label={`Archive ${g.name}`}>
                    Archive
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-linesoft">
                <Switch checked={Boolean(g.hidden)} onChange={() => toggleHidden(g)} label="Hide from Directory" />
                {g.hidden && (
                  <Switch
                    checked={Boolean(g.hide_restricts_access)}
                    onChange={() => toggleRestrictsAccess(g)}
                    label="Also restrict current members' access"
                  />
                )}
              </div>
            </div>
          ))}
          {groups.length === 0 && <p className="text-sm text-inkfaint">No ministries created yet.</p>}
        </div>

        {groups.some((g) => g.archived_at) && (
          <>
            <p className="text-xs uppercase tracking-wide text-inkfaint mt-5 mb-1">Archived ministries</p>
            <p className="text-xs text-inkfaint mb-2">
              Hidden from everyone but admins, with everything kept. Restore one to bring it back exactly as it was.
            </p>
            <div className="space-y-2">
              {groups
                .filter((g) => g.archived_at)
                .map((g) => (
                  <div key={g.id} className="sp-card flex justify-between items-center gap-2">
                    <span className="text-sm text-inksoft min-w-0 truncate">
                      {g.name} {g.type && <span className="text-inkfaint">({g.type})</span>}
                    </span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button onClick={() => restoreGroup(g)} className="sp-btn-sage text-xs py-1.5 px-3" aria-label={`Restore ${g.name}`}>
                        Restore
                      </button>
                      <button
                        onClick={() => deleteGroupPermanently(g)}
                        className="text-xs text-red-600 dark:text-red-400 underline"
                        aria-label={`Delete ${g.name} permanently`}
                      >
                        Delete permanently…
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}

        {groups.some((g) => !g.archived_at) && (
          <details className="mt-4">
            <summary className="text-xs text-inkfaint cursor-pointer">Permanently delete a ministry…</summary>
            <p className="text-xs text-inkfaint mt-2 mb-2">
              This can't be undone and asks for your PIN. If you just want a ministry out of sight, Archive it instead —
              that keeps everything.
            </p>
            <div className="space-y-1.5">
              {groups
                .filter((g) => !g.archived_at)
                .map((g) => (
                  <button
                    key={g.id}
                    onClick={() => deleteGroupPermanently(g)}
                    className="block text-xs text-red-600 dark:text-red-400 underline"
                    aria-label={`Delete ${g.name} permanently`}
                  >
                    Delete {g.name} permanently…
                  </button>
                ))}
            </div>
          </details>
        )}

        {message && <p className="text-sm text-inksoft mt-3">{message}</p>}

        <p className="text-xs uppercase tracking-wide text-inkfaint mt-6 mb-2">All Users</p>
        <p className="text-xs text-inkfaint mb-2">
          Every registered account. Only promote people you trust — admins can manage every ministry and
          everyone's account.
        </p>
        {users.length > 6 && (
          <div className="relative mb-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
            <input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Search users..."
              className="sp-input pl-9"
            />
          </div>
        )}
        {users.length > 0 && filteredUsers.length === 0 && (
          <p className="text-sm text-inkfaint mb-2">No users match that search.</p>
        )}
        <div className="space-y-2">
          {filteredUsers.map((u) => (
            <div key={u.id} className="sp-card flex flex-wrap justify-between items-center">
              <span className="text-sm text-ink">
                {u.display_name} <span className="text-inkfaint">(@{u.username})</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openUserMinistryPanel(u)}
                  className="sp-btn-secondary text-xs py-1.5 px-3"
                >
                  Block ministries
                </button>
                <button
                  onClick={() => toggleAdmin(u)}
                  disabled={pendingUserId === u.id}
                  className={u.is_church_admin ? "sp-btn-secondary text-xs py-1.5 px-3 disabled:opacity-50" : "sp-btn-sage text-xs py-1.5 px-3 disabled:opacity-50"}
                >
                  {pendingUserId === u.id ? "..." : u.is_church_admin ? "Remove admin" : "Make admin"}
                </button>
              </div>
              {u.is_church_admin && (
                <Switch
                  className="basis-full mt-2 pt-2 border-t border-linesoft"
                  checked={Boolean(u.admin_notifications_enabled)}
                  onChange={() => toggleAdminNotifications(u)}
                  busy={pendingNotifId === u.id}
                  label="Admin notifications"
                  description="Join requests, feedback and promotion requests. Turning it off doesn't change their admin access."
                />
              )}
              {!u.is_church_admin && u.id !== currentUserId && (
                <button
                  onClick={() => deleteAccount(u)}
                  className="basis-full text-left mt-2 pt-2 border-t border-linesoft text-xs text-red-600 dark:text-red-400 underline"
                  aria-label={`Delete ${u.display_name}'s account`}
                >
                  Delete account…
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => setLogOpen((o) => !o)}
          className="flex items-center justify-between w-full mt-6 mb-2"
        >
          <p className="text-xs uppercase tracking-wide text-inkfaint">Activity Log</p>
          <span className="text-xs text-inkfaint">{logOpen ? "Hide" : "Show"}</span>
        </button>
        {logOpen && (
          <div className="space-y-1.5">
            {activityLog === null && <SkeletonRowList count={3} />}
            {activityLog?.length === 0 && <p className="text-sm text-inkfaint">No admin activity yet.</p>}
            {activityLog?.map((entry) => {
              const expanded = logExpandedId === entry.id;
              return (
                <div key={entry.id} className="sp-card py-2.5">
                  <button
                    onClick={() => setLogExpandedId(expanded ? null : entry.id)}
                    aria-expanded={expanded}
                    className="w-full text-left flex justify-between items-baseline gap-2"
                  >
                    <span className="text-sm text-ink">{entry.line}</span>
                    <span className="text-xs text-inkfaint flex-shrink-0">{timeAgo(entry.created_at)}</span>
                  </button>
                  {expanded && (
                    <dl className="mt-2 pt-2 border-t border-linesoft text-xs text-inkfaint grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 m-0">
                      <dt>When</dt>
                      <dd className="m-0">{new Date(entry.created_at).toLocaleString()}</dd>
                      <dt>Action</dt>
                      <dd className="m-0 break-words">{entry.raw?.action}</dd>
                      {entry.raw?.meta && (
                        <>
                          <dt>Details</dt>
                          <dd className="m-0 break-all">{JSON.stringify(entry.raw.meta)}</dd>
                        </>
                      )}
                    </dl>
                  )}
                </div>
              );
            })}
            {logHasMore && (
              <button
                onClick={loadMoreLog}
                disabled={logLoadingMore}
                className="sp-btn-secondary text-sm w-full disabled:opacity-60"
              >
                {logLoadingMore ? "Loading…" : "Load older entries"}
              </button>
            )}
          </div>
        )}

      {manageUser && (
        <Modal
          title={`Block ministries for ${manageUser.display_name}`}
          headingClassName="font-serif text-lg text-ink m-0 min-w-0 truncate"
          onClose={() => setManageUser(null)}
          z={70}
          maxHeight="75vh"
        >
            <p className="text-xs text-inkfaint mb-3">
          Checking a ministry blocks it for this person only — they won't see it anywhere in the app,
          can't request to join, and if they're already a member, that membership is removed right away.
        </p>
        <div className="space-y-1.5">
          {groups.map((g) => {
            const blocked = hiddenGroupIds.includes(g.id);
            return (
              <label key={g.id} className="flex items-center gap-2 text-sm text-inksoft sp-card py-2">
                <input
                  type="checkbox"
                  checked={blocked}
                  onChange={() => toggleUserMinistryBlock(g.id, blocked)}
                />
                {g.name}
              </label>
            );
          })}
          {groups.length === 0 && <p className="text-sm text-inkfaint">No ministries created yet.</p>}
        </div>
        </Modal>
      )}
    </Modal>
  );
}
