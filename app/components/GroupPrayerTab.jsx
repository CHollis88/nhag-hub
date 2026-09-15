"use client";

import { useEffect, useState, useCallback } from "react";
import { Heart, Pencil, RefreshCw } from "lucide-react";
import EmptyState from "./EmptyState";

export default function GroupPrayerTab({ groupId, canManage }) {
  const [prayer, setPrayer] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/prayer`);
      const data = await res.json();
      if (res.ok) {
        setPrayer(data.prayer);
      } else {
        // A failed load used to leave the screen stuck on "Loading…"
        // forever with no explanation -- now it actually says what went
        // wrong and offers a way to try again, instead of hanging silently.
        setLoadError(data.error || "Couldn't load prayer requests.");
      }
    } catch {
      setLoadError("Couldn't reach the server. Check your connection and try again.");
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/groups/${groupId}/prayer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, is_anonymous: anonymous }),
    });
    if (res.ok) {
      setBody("");
      setAnonymous(false);
      load();
    }
  };

  const remove = async (id) => {
    await fetch(`/api/groups/${groupId}/prayer/${id}`, { method: "DELETE" });
    load();
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditBody(p.body);
  };

  const saveEdit = async (id) => {
    await fetch(`/api/groups/${groupId}/prayer/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editBody }),
    });
    setEditingId(null);
    load();
  };

  // Optimistic update, then reconcile with the server -- matches the
  // toggle-with-count mechanic exactly, just applied instantly on tap
  // rather than waiting on the round trip.
  const pray = async (id) => {
    setPrayer((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, i_prayed: !p.i_prayed, pray_count: p.pray_count + (p.i_prayed ? -1 : 1) }
          : p
      )
    );
    await fetch(`/api/groups/${groupId}/prayer/${id}/pray`, { method: "POST" });
    load();
  };

  return (
    <div className="px-5 pt-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-2xl text-ink">Prayer Requests</h2>
        <button onClick={load} aria-label="Refresh" title="Refresh" className="text-inkfaint p-1">
          <RefreshCw size={16} />
        </button>
      </div>

      <form onSubmit={submit} className="sp-card mb-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share a prayer request…"
          required
          rows={3}
          className="sp-textarea mb-2"
        />
        <label className="flex items-center gap-2 mb-2 text-sm text-inksoft">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          Submit anonymously
        </label>
        <button type="submit" className="sp-btn-primary">Submit</button>
      </form>

      {prayer === null && !loadError && <EmptyState icon={Heart} text="Loading…" />}
      {loadError && (
        <div className="sp-card border-red-200 dark:border-red-900 mb-2">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{loadError}</p>
          <button onClick={load} className="sp-btn-secondary py-1.5 px-3 text-sm flex items-center gap-1.5 w-fit">
            <RefreshCw size={13} /> Try again
          </button>
        </div>
      )}
      {prayer?.length === 0 && <p className="text-sm text-inkfaint">No prayer requests yet.</p>}
      <div className="space-y-2">
        {prayer?.map((p) => {
          const isEditing = editingId === p.id;
          return (
            <div key={p.id} className="sp-card">
              {isEditing ? (
                <>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    className="sp-textarea mb-2"
                  />
                  <div className="flex gap-3">
                    <button onClick={() => saveEdit(p.id)} className="sp-btn-primary py-1.5 px-3 text-sm">
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-inkfaint underline">
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-inksoft whitespace-pre-wrap mb-2">{p.body}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-inkfaint">
                      {p.is_anonymous ? "Anonymous" : p.users?.display_name} ·{" "}
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => pray(p.id)}
                      className={`sp-pill-outline ${p.i_prayed ? "active" : ""}`}
                    >
                      <Heart size={12} fill={p.i_prayed ? "rgb(var(--color-sage))" : "none"} />
                      {p.i_prayed ? "Praying" : "I'm praying"} · {p.pray_count || 0}
                    </button>
                  </div>
                  <div className="flex gap-3 mt-2">
                    {p.is_mine && (
                      <button onClick={() => startEdit(p)} className="text-xs text-accent underline flex items-center gap-1">
                        <Pencil size={11} /> Edit
                      </button>
                    )}
                    {(p.is_mine || canManage) && (
                      <button onClick={() => remove(p.id)} className="text-xs text-inkfaint underline">
                        Remove
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
