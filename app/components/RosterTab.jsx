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
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-4">Roster</h2>

      {canManage && pending?.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Pending requests</p>
          <div className="space-y-2 mb-4">
            {pending.map((p) => (
              <div key={p.id} className="sp-card flex justify-between items-center">
                <span className="text-sm text-ink">{p.users?.display_name} (@{p.users?.username})</span>
                <div className="flex gap-2">
                  <button onClick={() => approve(p.id)} className="sp-btn-sage text-xs py-1.5 px-3">Approve</button>
                  <button onClick={() => reject(p.id)} className="sp-btn-secondary text-xs py-1.5 px-3">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Members</p>
      {active === null && <p className="text-sm text-inkfaint">Loading…</p>}
      <div className="space-y-2">
        {active?.map((m) => (
          <div key={m.id} className="sp-card flex justify-between items-center">
            <span className="text-sm text-ink">
              {m.users?.display_name} (@{m.users?.username}){" "}
              {m.role === "leader" && <span className="text-inkfaint text-xs">· Leader</span>}
            </span>
            {canManage && (
              <div className="flex gap-2">
                <button onClick={() => promote(m.id, m.role)} className="text-xs text-accent underline">
                  {m.role === "leader" ? "Make member" : "Make leader"}
                </button>
                <button onClick={() => removeMember(m.id)} className="text-xs text-inkfaint underline">
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

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
            <button type="submit" className="sp-btn-secondary px-4">Add</button>
          </form>
          {message && <p className="text-sm text-inkfaint mt-2">{message}</p>}
        </>
      )}
    </div>
  );
}
