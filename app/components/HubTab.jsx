"use client";

import { useEffect, useState, useCallback } from "react";

// The Hub: the launcher into ministries. Shows the groups you're already
// in (with a Launch button into that group's own contextual shell), lets
// you browse every group to request joining ones you're not in yet, and
// -- if you're a Church Admin -- lets you create new groups outright.
export default function HubTab({ me, refreshMe, onOpenGroup }) {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState("");
  const [newGroupFeatures, setNewGroupFeatures] = useState([]);
  const [message, setMessage] = useState("");

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
    const data = await res.json();
    if (res.ok) setGroups(data.groups);
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const myMemberships = me.memberships.filter((m) => m.status === "active");
  const myGroupIds = new Set(me.memberships.map((m) => m.group_id));

  const toggleFeature = (key) => {
    setNewGroupFeatures((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  };

  const createGroup = async (e) => {
    e.preventDefault();
    setMessage("");
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName, type: newGroupType, features: newGroupFeatures }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    setNewGroupName("");
    setNewGroupType("");
    setNewGroupFeatures([]);
    loadGroups();
  };

  const requestJoin = async (groupId) => {
    setMessage("");
    const res = await fetch(`/api/groups/${groupId}/join-request`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? "Join request sent." : data.error);
    refreshMe();
  };

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-4">Hub</h2>

      <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Your ministries</p>
      {myMemberships.length === 0 && (
        <p className="text-sm text-inkfaint mb-2">You're not in any ministries yet — browse below to request joining one.</p>
      )}
      <div className="space-y-2 mb-2">
        {myMemberships.map((m) => (
          <div key={m.group_id} className="sp-card flex justify-between items-center">
            <div>
              <p className="font-medium text-ink">{m.group?.name}</p>
              <p className="text-xs text-inkfaint">{m.role === "leader" ? "Ministry Leader" : "Member"}</p>
            </div>
            <button
              onClick={() => onOpenGroup(m.group_id, m.group?.name, m.role, m.group?.features)}
              className="sp-btn-pill"
            >
              Launch
            </button>
          </div>
        ))}
      </div>
      {me.memberships.some((m) => m.status === "pending") && (
        <p className="text-xs text-inkfaint mb-4">
          {me.memberships.filter((m) => m.status === "pending").map((m) => m.group?.name).join(", ")}{" "}
          — request pending approval.
        </p>
      )}

      <p className="text-xs uppercase tracking-wide text-inkfaint mt-6 mb-2">Browse all ministries</p>
      <div className="space-y-2">
        {groups
          .filter((g) => !myGroupIds.has(g.id))
          .map((g) => (
            <div key={g.id} className="sp-card flex justify-between items-center">
              <span className="text-sm text-ink">
                {g.name} {g.type && <span className="text-inkfaint">({g.type})</span>}
              </span>
              <button onClick={() => requestJoin(g.id)} className="sp-btn-secondary text-xs py-1.5 px-3">
                Request to join
              </button>
            </div>
          ))}
      </div>

      {me.user.is_church_admin && (
        <>
          <p className="text-xs uppercase tracking-wide text-inkfaint mt-6 mb-2">Create a ministry</p>
          <form onSubmit={createGroup} className="sp-card">
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
            <p className="text-xs text-inkfaint mb-2">Optional modules:</p>
            <label className="flex items-center gap-2 mb-1.5 text-sm text-inksoft">
              <input
                type="checkbox"
                checked={newGroupFeatures.includes("songs_setlists")}
                onChange={() => toggleFeature("songs_setlists")}
              />
              Song library + Setlists (Choir-style groups)
            </label>
            <label className="flex items-center gap-2 mb-4 text-sm text-inksoft">
              <input
                type="checkbox"
                checked={newGroupFeatures.includes("reading_plan_journal")}
                onChange={() => toggleFeature("reading_plan_journal")}
              />
              Reading Plan + Journal (Young Adults-style groups)
            </label>
            <button type="submit" className="sp-btn-primary">Create</button>
          </form>
        </>
      )}

      {message && <p className="text-sm text-inksoft mt-3">{message}</p>}
    </div>
  );
}
