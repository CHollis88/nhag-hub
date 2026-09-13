"use client";

import { useEffect, useState, useCallback, useRef } from "react";

function AppearancePanel({ groupId, onRenamed }) {
  const [group, setGroup] = useState(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8B1E2F");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    const data = await res.json();
    if (res.ok) {
      setGroup(data.group);
      setName(data.group.name);
      setColor(data.group.tile_color || "#8B1E2F");
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveColor = async (newColor) => {
    setColor(newColor);
    await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tile_color: newColor }),
    });
  };

  const saveName = async (e) => {
    e.preventDefault();
    setMessage("");
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    setMessage("Renamed.");
    onRenamed?.(trimmed);
  };

  const uploadIcon = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/groups/${groupId}/icon`, { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    load();
  };

  if (!group) return null;

  return (
    <div className="sp-card mb-4">
      <p className="text-xs uppercase tracking-wide text-inkfaint mb-3">Ministry appearance</p>
      <div className="flex items-center gap-4 mb-3">
        {group.image_url ? (
          <img src={group.image_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
        ) : (
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-serif text-2xl"
            style={{ background: color }}
          >
            {group.name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="sp-btn-secondary text-xs py-1.5 px-3 mb-2"
          >
            {uploading ? "Uploading…" : "Change icon"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadIcon} className="hidden" />
          <label className="flex items-center gap-2 text-sm text-inksoft">
            Tile color:
            <input type="color" value={color} onChange={(e) => saveColor(e.target.value)} className="w-9 h-7 rounded border border-line" />
          </label>
        </div>
      </div>
      <form onSubmit={saveName} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ministry name"
          className="sp-input flex-1"
        />
        <button type="submit" className="sp-btn-secondary px-4">Rename</button>
      </form>
      {message && <p className="text-sm mt-2 text-red-600 dark:text-red-400">{message}</p>}
    </div>
  );
}

// Unlike News/Events/Prayer (Phase 3), Roster is fully real here — it's
// just a UI on top of the group_members data and API routes that already
// exist from Foundation. Every member can view the roster; only a leader
// of this group (or a Church Admin) sees and can act on the pending queue.
export default function RosterTab({ groupId, myRole, onRenamed }) {
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

      {canManage && <AppearancePanel groupId={groupId} onRenamed={onRenamed} />}

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
