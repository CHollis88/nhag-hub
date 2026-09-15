"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Wrench, Search } from "lucide-react";

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

const ACTION_LABELS = {
  ministry_created: "Created a ministry",
  ministry_deleted: "Deleted a ministry",
  admin_promoted: "Promoted an admin",
  admin_demoted: "Removed admin access",
  promotion_approved: "Approved a promotion",
  promotion_rejected: "Rejected a promotion",
};

// Opened on demand from Settings, rather than always rendered inline on
// Home -- per the project's decision, admin-only controls shouldn't
// permanently take up space on the screen everyone sees every day.
export default function AdminToolboxView({ onClose, onOpenGroup }) {
  const [users, setUsers] = useState([]);
  const [userQuery, setUserQuery] = useState("");
  const [activityLog, setActivityLog] = useState(null);
  const [logOpen, setLogOpen] = useState(false);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) setUsers(data.users);
  }, []);

  const filteredUsers = useMemo(() => {
    if (!userQuery.trim()) return users;
    const q = userQuery.toLowerCase();
    return users.filter(
      (u) => u.display_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
    );
  }, [users, userQuery]);

  const loadActivityLog = useCallback(async () => {
    const res = await fetch("/api/admin/activity-log");
    const data = await res.json();
    if (res.ok) setActivityLog(data.entries);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (logOpen && activityLog === null) loadActivityLog();
  }, [logOpen, activityLog, loadActivityLog]);

  const toggleAdmin = async (targetUser) => {
    const res = await fetch(`/api/admin/users/${targetUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_church_admin: !targetUser.is_church_admin }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    loadUsers();
  };

  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("#8B1E2F");
  const [message, setMessage] = useState("");
  const [pendingCounts, setPendingCounts] = useState({});

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
    const data = await res.json();
    if (res.ok) setGroups(data.groups);
  }, []);

  const loadPendingCounts = useCallback(async (groupList) => {
    const results = await Promise.all(
      groupList.map(async (g) => {
        const res = await fetch(`/api/groups/${g.id}/members`);
        const data = await res.json();
        return [g.id, res.ok ? (data.pending?.length || 0) : 0];
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
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName, type: newGroupType, tile_color: newGroupColor }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
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

  const deleteGroup = async (group) => {
    if (!confirm(`Delete "${group.name}"? This removes all of its News, Events, Prayer, Roster, and any Songs/Setlists or Reading Plan data. This can't be undone.`)) return;
    setMessage("");
    const res = await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    loadGroups();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-[60]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-t-2xl w-full max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-xl text-ink m-0 flex items-center gap-2">
            <Wrench size={18} className="text-inkfaint" /> Admin Toolbox
          </h2>
          <button onClick={onClose} className="text-2xl text-inkfaint leading-none">×</button>
        </div>

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

        <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Manage ministries</p>
        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.id} className="sp-card flex justify-between items-center">
              <span className="text-sm text-ink">
                {g.name} {g.type && <span className="text-inkfaint">({g.type})</span>}
                {pendingCounts[g.id] > 0 && (
                  <span className="ml-2 text-xs bg-accent text-white rounded-full px-2 py-0.5">
                    {pendingCounts[g.id]} pending
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => manage(g)} className="sp-btn-secondary text-xs py-1.5 px-3">
                  Manage
                </button>
                <button onClick={() => deleteGroup(g)} className="text-xs text-inkfaint underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {groups.length === 0 && <p className="text-sm text-inkfaint">No ministries created yet.</p>}
        </div>

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
            <div key={u.id} className="sp-card flex justify-between items-center">
              <span className="text-sm text-ink">
                {u.display_name} <span className="text-inkfaint">(@{u.username})</span>
              </span>
              <button
                onClick={() => toggleAdmin(u)}
                className={u.is_church_admin ? "sp-btn-secondary text-xs py-1.5 px-3" : "sp-btn-sage text-xs py-1.5 px-3"}
              >
                {u.is_church_admin ? "Remove admin" : "Make admin"}
              </button>
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
            {activityLog === null && <p className="text-sm text-inkfaint">Loading…</p>}
            {activityLog?.length === 0 && <p className="text-sm text-inkfaint">No admin activity yet.</p>}
            {activityLog?.map((entry) => (
              <div key={entry.id} className="sp-card py-2.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-ink">
                    {entry.users?.display_name || "Someone"} — {ACTION_LABELS[entry.action] || entry.action}
                  </span>
                  <span className="text-xs text-inkfaint flex-shrink-0 ml-2">{timeAgo(entry.created_at)}</span>
                </div>
                {entry.details && <p className="text-xs text-inkfaint mt-0.5">{entry.details}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
