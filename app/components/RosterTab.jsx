"use client";

import { useEffect, useState, useCallback } from "react";

// Unlike News/Events/Prayer (Phase 3), Roster is fully real here — it's
// just a UI on top of the group_members data and API routes that already
// exist from Foundation. Every member can view the roster; only a leader
// of this group (or a Church Admin) sees and can act on the pending queue.
export default function RosterTab({ groupId, myRole }) {
  const [active, setActive] = useState(null);
  const [pending, setPending] = useState(null);
  const [addUsername, setAddUsername] = useState("");
  const [message, setMessage] = useState("");
  const canManage = myRole === "leader" || myRole === "admin";

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/members`);
    const data = await res.json();
    if (res.ok) {
      setActive(data.active);
      setPending(data.pending || []);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (memberRowId) => {
    await fetch(`/api/groups/${groupId}/members/${memberRowId}/approve`, { method: "POST" });
    load();
  };

  const reject = async (memberRowId) => {
    await fetch(`/api/groups/${groupId}/members/${memberRowId}`, { method: "DELETE" });
    load();
  };

  const removeMember = async (memberRowId) => {
    if (!confirm("Remove this person from the group? They'll lose access to all group content.")) return;
    await fetch(`/api/groups/${groupId}/members/${memberRowId}`, { method: "DELETE" });
    load();
  };

  const promote = async (memberRowId, currentRole) => {
    const newRole = currentRole === "leader" ? "member" : "leader";
    await fetch(`/api/groups/${groupId}/members/${memberRowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    load();
  };

  // Two-step: look the username up first so we can add them straight in
  // as an active member (per the project's decision — a leader adding
  // someone directly skips the join-request/approval step entirely).
  const addByUsername = async (e) => {
    e.preventDefault();
    setMessage("");
    const lookup = await fetch(`/api/users/lookup?username=${encodeURIComponent(addUsername.trim())}`);
    const lookupData = await lookup.json();
    if (!lookup.ok) {
      setMessage(lookupData.error);
      return;
    }

    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: lookupData.user.id, role: "member" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    setMessage(`Added ${lookupData.user.display_name}.`);
    setAddUsername("");
    load();
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Roster</h2>

      {canManage && pending?.length > 0 && (
        <>
          <h3>Pending requests</h3>
          {pending.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#fff",
                borderRadius: 8,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <span>{p.users?.display_name} (@{p.users?.username})</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => approve(p.id)}>Approve</button>
                <button onClick={() => reject(p.id)}>Reject</button>
              </div>
            </div>
          ))}
        </>
      )}

      <h3 style={{ marginTop: canManage && pending?.length > 0 ? 24 : 0 }}>Members</h3>
      {active === null && <p>Loading…</p>}
      {active?.map((m) => (
        <div
          key={m.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#fff",
            borderRadius: 8,
            padding: 12,
            marginBottom: 8,
          }}
        >
          <span>
            {m.users?.display_name} (@{m.users?.username}){" "}
            <span style={{ color: "#999", fontSize: 13 }}>
              {m.role === "leader" ? "· Leader" : ""}
            </span>
          </span>
          {canManage && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => promote(m.id, m.role)} style={{ fontSize: 12 }}>
                {m.role === "leader" ? "Make member" : "Make leader"}
              </button>
              <button onClick={() => removeMember(m.id)} style={{ fontSize: 12 }}>
                Remove
              </button>
            </div>
          )}
        </div>
      ))}

      {canManage && (
        <>
          <h3 style={{ marginTop: 24 }}>Add someone</h3>
          <form onSubmit={addByUsername} style={{ display: "flex", gap: 8 }}>
            <input
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              placeholder="username"
              style={{ flex: 1, padding: 8 }}
            />
            <button type="submit">Add</button>
          </form>
          {message && <p style={{ color: "#666", fontSize: 13 }}>{message}</p>}
        </>
      )}
    </div>
  );
}
