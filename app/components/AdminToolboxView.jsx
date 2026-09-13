"use client";

import { useEffect, useState, useCallback } from "react";

// Opened on demand from Settings, rather than always rendered inline on
// Home -- per the project's decision, admin-only controls shouldn't
// permanently take up space on the screen everyone sees every day.
export default function AdminToolboxView({ onClose, onOpenGroup }) {
  const [users, setUsers] = useState([]);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) setUsers(data.users);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
            <span>🧰</span> Admin Toolbox
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

        <p className="text-xs uppercase tracking-wide text-inkfaint mt-6 mb-2">Admins</p>
        <p className="text-xs text-inkfaint mb-2">
          Only promote people you trust — admins can manage every ministry and everyone's account.
        </p>
        <div className="space-y-2">
          {users.map((u) => (
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
      </div>
    </div>
  );
}
