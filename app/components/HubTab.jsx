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
    <div style={{ padding: 16 }}>
      <h2>Hub</h2>

      <h3>Your ministries</h3>
      {myMemberships.length === 0 && (
        <p style={{ color: "#666" }}>You're not in any ministries yet — browse below to request joining one.</p>
      )}
      {myMemberships.map((m) => (
        <div
          key={m.group_id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#fff",
            borderRadius: 8,
            padding: 16,
            marginBottom: 8,
          }}
        >
          <div>
            <strong>{m.group?.name}</strong>
            <div style={{ fontSize: 13, color: "#666" }}>
              {m.role === "leader" ? "Ministry Leader" : "Member"}
            </div>
          </div>
          <button onClick={() => onOpenGroup(m.group_id, m.group?.name, m.role, m.group?.features)}>Launch</button>
        </div>
      ))}
      {me.memberships.some((m) => m.status === "pending") && (
        <p style={{ color: "#666", fontSize: 13 }}>
          {me.memberships.filter((m) => m.status === "pending").map((m) => m.group?.name).join(", ")}{" "}
          — request pending approval.
        </p>
      )}

      <h3 style={{ marginTop: 24 }}>Browse all ministries</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {groups
          .filter((g) => !myGroupIds.has(g.id))
          .map((g) => (
            <li
              key={g.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                background: "#fff",
                borderRadius: 8,
                padding: "12px 16px",
                marginBottom: 8,
              }}
            >
              <span>
                {g.name} {g.type && <span style={{ color: "#999" }}>({g.type})</span>}
              </span>
              <button onClick={() => requestJoin(g.id)}>Request to join</button>
            </li>
          ))}
      </ul>

      {me.user.is_church_admin && (
        <>
          <h3 style={{ marginTop: 24 }}>Create a ministry</h3>
          <form onSubmit={createGroup} style={{ padding: 16, background: "#fff", borderRadius: 8 }}>
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Ministry name (e.g. Wednesday Night, Security Team)"
              required
              style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
            />
            <input
              value={newGroupType}
              onChange={(e) => setNewGroupType(e.target.value)}
              placeholder="Type / category label (optional, just for display)"
              style={{ width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box" }}
            />
            <p style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>Optional modules:</p>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={newGroupFeatures.includes("songs_setlists")}
                onChange={() => toggleFeature("songs_setlists")}
              />
              Song library + Setlists (Choir-style groups)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={newGroupFeatures.includes("reading_plan_journal")}
                onChange={() => toggleFeature("reading_plan_journal")}
              />
              Reading Plan + Journal (Young Adults-style groups)
            </label>
            <button type="submit">Create</button>
          </form>
        </>
      )}

      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </div>
  );
}
