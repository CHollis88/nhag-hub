"use client";

import { Users } from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { PLAN_LIST } from "@/lib/planRegistry";
import { readableTextColor } from "@/lib/colorContrast";
import EmptyState from "./EmptyState";

function AppearancePanel({ groupId, onRenamed }) {
  const [group, setGroup] = useState(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
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
      setType(data.group.type || "");
      setDescription(data.group.description || "");
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

  const saveNameAndType = async (e) => {
    e.preventDefault();
    setMessage("");
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmedName, type: type.trim(), description: description.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    setMessage("Saved.");
    onRenamed?.(trimmedName);
  };

  const savePlanLock = async (locked, planId) => {
    setGroup((g) => ({ ...g, reading_plan_locked: locked, reading_plan_id: planId }));
    await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reading_plan_locked: locked, reading_plan_id: planId }),
    });
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
            className="w-16 h-16 rounded-xl flex items-center justify-center font-serif text-2xl"
            style={{ background: color, color: readableTextColor(color) }}
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
      <form onSubmit={saveNameAndType} className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ministry name"
          className="sp-input"
        />
        <input
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="Type / category label (optional)"
          className="sp-input"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this ministry? (shown to people considering joining)"
          rows={3}
          className="sp-textarea"
        />
        <button type="submit" className="sp-btn-secondary">Save</button>
      </form>
      {message && <p className="text-sm mt-2 text-red-600 dark:text-red-400">{message}</p>}

      {group.features?.includes("reading_plan_journal") && (
        <div className="mt-4 pt-4 border-t border-linesoft">
          <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Reading Plan</p>
          <label className="flex items-center gap-2 mb-2 text-sm text-inksoft">
            <input
              type="checkbox"
              checked={group.reading_plan_locked}
              onChange={(e) => savePlanLock(e.target.checked, group.reading_plan_id || "foundations")}
            />
            Lock everyone in this group onto one plan together
          </label>
          <p className="text-xs text-inkfaint mb-2">
            {group.reading_plan_locked
              ? "Everyone in this group follows the plan below."
              : "Unlocked — each member picks their own plan from the same list."}
          </p>
          {group.reading_plan_locked && (
            <select
              value={group.reading_plan_id}
              onChange={(e) => savePlanLock(true, e.target.value)}
              className="sp-input"
            >
              {PLAN_LIST.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.totalDays} days)
                </option>
              ))}
            </select>
          )}
        </div>
      )}
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
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
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
      const lookup = await fetch(`/api/users/lookup?username=${encodeURIComponent(username)}`);
      const lookupData = await lookup.json();
      if (!lookup.ok) {
        results.push({ username, ok: false, message: lookupData.error });
        continue;
      }
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: lookupData.user.id, role: "member" }),
      });
      const data = await res.json();
      results.push({
        username,
        ok: res.ok,
        message: res.ok ? `Added ${lookupData.user.display_name}` : data.error,
      });
    }

    setBulkResults(results);
    setBulkBusy(false);
    setBulkText("");
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
      {active === null && <EmptyState icon={Users} text="Loading…" />}
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

          <button
            onClick={() => setShowBulk((s) => !s)}
            className="text-xs text-accent underline mt-3 block"
          >
            {showBulk ? "Hide bulk add" : "Add multiple people at once"}
          </button>

          {showBulk && (
            <form onSubmit={addBulk} className="sp-card mt-2">
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
    </div>
  );
}
