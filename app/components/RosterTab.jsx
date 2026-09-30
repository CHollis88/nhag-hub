"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { SkeletonRowList } from "./Skeleton";
import MinistrySettingsSheet from "./MinistrySettingsSheet";
import RowMenu from "./RowMenu";
import { useFormDisclosure } from "./useFormDisclosure";
import EmptyState from "./EmptyState";
import { useConfirm } from "./ConfirmDialog";
import { useAction } from "./useAction";
import { requestJson, errorMessage } from "@/lib/request";
import { useResource } from "@/lib/useResource";
import { STALE } from "@/lib/resourceCache";
import { useScreenState, useScrollMemory } from "@/lib/useScreenState";

// Unlike News/Events/Prayer (Phase 3), Roster is fully real here — it's
// just a UI on top of the group_members data and API routes that already
// exist from Foundation. Every member can view the roster; only a leader
// of this group (or a Church Admin) sees and can act on the pending queue.
export default function RosterTab({ groupId, myRole, onRenamed, onLeave }) {
  const [addUsername, setAddUsername] = useState("");
  // v71 #36: the bulk-add form focuses its first field on open and returns
  // focus to its toggle link when closed.
  const bulkForm = useFormDisclosure();
  const showBulk = bulkForm.open;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useScreenState(`roster:${groupId}:query`, "");
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const [message, setMessage] = useState("");
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const canManage = myRole === "leader" || myRole === "admin";

  const confirm = useConfirm();
  const run = useAction();

  const leaveGroup = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await requestJson(`/api/groups/${groupId}/leave`, { method: "DELETE" });
      onLeave();
    } catch (err) {
      setLeaving(false);
      setConfirmingLeave(false);
      setMessage(errorMessage(err, "Couldn't leave the group."));
    }
  };

  // v71 #42-45: members and join requests come through the shared cache, with
  // the SHORT (live) stale time -- a new join request should appear within
  // seconds of coming back. The search text and scroll spot are remembered.
  const membersKey = `group:${groupId}:members`;
  const { data: membersData, error: membersError, refresh } = useResource(
    membersKey,
    () => requestJson(`/api/groups/${groupId}/members`),
    { staleMs: STALE.live }
  );
  const active = membersData ? membersData.active : null;
  const pending = membersData ? membersData.pending || [] : null;
  const loadFailed = Boolean(membersError);
  const load = () => refresh().catch(() => {}); // failures show through `loadFailed`
  const scrollAnchor = useScrollMemory(`roster:${groupId}`, active !== null);

  // v71 #33: leaders first, then everyone A-Z, whatever order the server
  // returned. A search box appears once the list is long enough to need one.
  const SEARCH_THRESHOLD = 8;
  const sortedActive = useMemo(() => {
    if (!active) return null;
    const name = (m) => (m.users?.display_name || m.users?.username || "").toLowerCase();
    return [...active].sort((a, b) => {
      const leaderDiff = Number(b.role === "leader") - Number(a.role === "leader");
      return leaderDiff || name(a).localeCompare(name(b));
    });
  }, [active]);
  const showSearch = (sortedActive?.length || 0) > SEARCH_THRESHOLD;
  const visibleMembers = useMemo(() => {
    if (!sortedActive) return null;
    const q = showSearch ? memberQuery.trim().toLowerCase() : "";
    if (!q) return sortedActive;
    return sortedActive.filter((m) => `${m.users?.display_name || ""} ${m.users?.username || ""}`.toLowerCase().includes(q));
  }, [sortedActive, memberQuery, showSearch]);

  const [pendingActionId, setPendingActionId] = useState(null);

  // One helper for the four row actions: marks the row busy, runs the
  // request, reports failure, and always refreshes so the list shows what's
  // actually true (including after a failure).
  const rowAction = async (memberRowId, request, success) => {
    if (pendingActionId) return; // one at a time -- no double taps
    setPendingActionId(memberRowId);
    await run(request, { success });
    await load();
    setPendingActionId(null);
  };

  const approve = (p) =>
    rowAction(p.id, () => requestJson(`/api/groups/${groupId}/members/${p.id}/approve`, { method: "POST" }), `${p.users?.display_name || "Member"} approved`);

  const reject = (p) =>
    rowAction(p.id, () => requestJson(`/api/groups/${groupId}/members/${p.id}`, { method: "DELETE" }), "Request rejected");

  const removeMember = async (m) => {
    const name = m.users?.display_name || "this person";
    const yes = await confirm({
      title: `Remove ${name} from the group?`,
      message: "They'll lose access to everything in this ministry right away.",
      confirmLabel: "Remove",
    });
    if (!yes) return;
    rowAction(m.id, () => requestJson(`/api/groups/${groupId}/members/${m.id}`, { method: "DELETE" }), `${name} removed`);
  };

  const promote = (m) => {
    const newRole = m.role === "leader" ? "member" : "leader";
    return rowAction(
      m.id,
      () => requestJson(`/api/groups/${groupId}/members/${m.id}`, { method: "PATCH", body: { role: newRole } }),
      `${m.users?.display_name || "Member"} is now a ${newRole}`
    );
  };

  const addByUsername = async (e) => {
    e.preventDefault();
    if (!addUsername.trim() || adding) return;
    setMessage("");
    setAdding(true);
    try {
      const lookupData = await requestJson(`/api/users/lookup?username=${encodeURIComponent(addUsername.trim())}`);
      await requestJson(`/api/groups/${groupId}/members`, {
        method: "POST",
        body: { user_id: lookupData.user.id, role: "member" },
      });
      setMessage(`Added ${lookupData.user.display_name}.`);
      setAddUsername("");
      load();
    } catch (err) {
      setMessage(err.message); // the username stays in the box to fix
    } finally {
      setAdding(false);
    }
  };

  const addBulk = async (e) => {
    e.preventDefault();
    setBulkResults(null);
    setBulkBusy(true);
    const usernames = bulkText
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    const results = [];
    for (const username of usernames) {
      try {
        const lookupData = await requestJson(`/api/users/lookup?username=${encodeURIComponent(username)}`);
        await requestJson(`/api/groups/${groupId}/members`, {
          method: "POST",
          body: { user_id: lookupData.user.id, role: "member" },
        });
        results.push({ username, ok: true, message: `Added ${lookupData.user.display_name}` });
      } catch (err) {
        results.push({ username, ok: false, message: err.message });
      }
    }

    setBulkResults(results);
    setBulkBusy(false);
    // Only the names that DIDN'T work stay in the box, so fixing a typo and
    // pressing the button again retries just those.
    setBulkText(results.filter((r) => !r.ok).map((r) => r.username).join("\n"));
    load();
  };

  return (
    <div className="px-5 pt-4 pb-6">
      <div ref={scrollAnchor} />
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h2 className="font-serif text-2xl text-ink m-0">Roster</h2>
        {canManage && (
          <button onClick={() => setSettingsOpen(true)} className="sp-btn-secondary text-sm py-1.5 px-3 min-h-[44px]">
            Ministry settings
          </button>
        )}
      </div>
      {settingsOpen && <MinistrySettingsSheet groupId={groupId} onRenamed={onRenamed} onClose={() => setSettingsOpen(false)} />}

      {canManage && pending?.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Pending requests</p>
          <div className="space-y-2 mb-4">
            {pending.map((p) => (
              <div key={p.id} className="sp-card flex justify-between items-center">
                <span className="text-sm text-ink">{p.users?.display_name} (@{p.users?.username})</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => approve(p)}
                    disabled={pendingActionId === p.id}
                    className="sp-btn-sage text-xs py-1.5 px-3 min-h-[44px] disabled:opacity-50"
                    aria-label={`Approve ${p.users?.display_name || "request"}`}
                  >
                    {pendingActionId === p.id ? "..." : "Approve"}
                  </button>
                  <button
                    onClick={() => reject(p)}
                    disabled={pendingActionId === p.id}
                    className="sp-btn-secondary text-xs py-1.5 px-3 min-h-[44px] disabled:opacity-50"
                    aria-label={`Reject ${p.users?.display_name || "request"}`}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">
        Members{sortedActive ? ` (${sortedActive.length})` : ""}
      </p>
      {showSearch && (
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" aria-hidden="true" />
          <label htmlFor="roster-search" className="sr-only">Search members</label>
          <input
            id="roster-search"
            type="search"
            value={memberQuery}
            onChange={(e) => setMemberQuery(e.target.value)}
            placeholder="Search members…"
            className="sp-input pl-9"
          />
        </div>
      )}
      {active === null && loadFailed && <EmptyState kind="error" text="Couldn't load the roster." onRetry={load} />}
      {active === null && !loadFailed && <SkeletonRowList count={5} />}
      {visibleMembers?.length === 0 && sortedActive?.length > 0 && (
        <p className="text-sm text-inkfaint py-3" role="status">No members match “{memberQuery}”.</p>
      )}
      <ul className="space-y-2 list-none p-0 m-0">
        {visibleMembers?.map((m) => {
          const name = m.users?.display_name || "this person";
          return (
            <li key={m.id} className="sp-card flex justify-between items-center gap-2 py-2">
              <span className="text-sm text-ink min-w-0">
                <span className="break-words">{m.users?.display_name}</span>{" "}
                <span className="text-inkfaint text-xs break-all">(@{m.users?.username})</span>{" "}
                {m.role === "leader" && <span className="text-inkfaint text-xs whitespace-nowrap">· Leader</span>}
              </span>
              {canManage && (
                <RowMenu
                  label={`Actions for ${name}`}
                  busy={pendingActionId === m.id}
                  items={[
                    { label: m.role === "leader" ? "Make member" : "Make leader", onSelect: () => promote(m) },
                    { label: "Remove from ministry", onSelect: () => removeMember(m), destructive: true },
                  ]}
                />
              )}
            </li>
          );
        })}
      </ul>

      {canManage && (
        <>
          <p className="text-xs uppercase tracking-wide text-inkfaint mt-6 mb-2">Add someone</p>
          <form onSubmit={addByUsername} className="flex gap-2">
            <input
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              placeholder="username"
              className="sp-input"
            />
            <button type="submit" disabled={adding || !addUsername.trim()} aria-busy={adding || undefined} className="sp-btn-secondary px-4 disabled:opacity-60">
              {adding ? "Adding…" : "Add"}
            </button>
          </form>
          {message && <p className="text-sm text-inkfaint mt-2">{message}</p>}

          <button
            ref={bulkForm.triggerRef}
            onClick={() => (bulkForm.open ? bulkForm.hide() : bulkForm.show())}
            className="text-sm text-accent underline mt-3 block min-h-[44px]"
            aria-expanded={showBulk}
          >
            {showBulk ? "Hide bulk add" : "Add multiple people at once"}
          </button>

          {showBulk && (
            <form ref={bulkForm.formRef} onSubmit={addBulk} className="sp-card mt-2">
              <p className="text-xs text-inkfaint mb-2">
                One username per line. Each is looked up and added the same as adding one at a time.
              </p>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"jsmith\nmjones\nkwilliams"}
                rows={6}
                className="sp-textarea mb-2"
              />
              <button type="submit" disabled={bulkBusy || !bulkText.trim()} className="sp-btn-secondary">
                {bulkBusy ? "Adding…" : "Add all"}
              </button>

              {bulkResults && (
                <div className="mt-3 space-y-1">
                  {bulkResults.map((r, i) => (
                    <p
                      key={i}
                      className={`text-xs ${r.ok ? "text-inksoft" : "text-red-600 dark:text-red-400"}`}
                    >
                      {r.username}: {r.message}
                    </p>
                  ))}
                </div>
              )}
            </form>
          )}
        </>
      )}

      {/* Self-service leave: visible to any member, leader or not, per
          Cam's explicit request. A confirm step guards it since
          re-joining requires another approval, not an instant undo. */}
      <div className="mt-8 pt-5 border-t border-linesoft">
        {!confirmingLeave ? (
          <button
            onClick={() => setConfirmingLeave(true)}
            className="text-xs text-red-600 dark:text-red-400 underline"
          >
            Leave this ministry
          </button>
        ) : (
          <div className="sp-card">
            <p className="text-sm text-ink mb-3">
              Leave this ministry? You'll lose access to its News, Events, and Prayer, and would need to
              request to join again later.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={leaveGroup}
                disabled={leaving}
                className="sp-btn-secondary sp-btn-compact text-red-600 dark:text-red-400"
              >
                {leaving ? "Leaving…" : "Yes, leave"}
              </button>
              <button onClick={() => setConfirmingLeave(false)} className="sp-btn-secondary sp-btn-compact">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
