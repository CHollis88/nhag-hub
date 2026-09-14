"use client";

import { useEffect, useState, useCallback } from "react";
import { Heart } from "lucide-react";

export default function GroupPrayerTab({ groupId, canManage, currentUserId }) {
  const [prayer, setPrayer] = useState(null);
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/prayer`);
    const data = await res.json();
    if (res.ok) setPrayer(data.prayer);
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
      <h2 className="font-serif text-2xl text-ink mb-4">Prayer Requests</h2>

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

      {prayer === null && <p className="text-sm text-inkfaint">Loading…</p>}
      {prayer?.length === 0 && <p className="text-sm text-inkfaint">No prayer requests yet.</p>}
      <div className="space-y-2">
        {prayer?.map((p) => {
          const isOwner = p.created_by === currentUserId;
          return (
            <div key={p.id} className="sp-card">
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
              {(isOwner || canManage) && (
                <button onClick={() => remove(p.id)} className="text-xs text-inkfaint mt-2 underline">
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
