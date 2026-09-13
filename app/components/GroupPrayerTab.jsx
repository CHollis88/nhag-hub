"use client";

import { useEffect, useState, useCallback } from "react";

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

  return (
    <div style={{ padding: 16 }}>
      <h2>Prayer Requests</h2>

      {/* Any active member can submit -- unlike News/Events, this isn't
          leader-gated. */}
      <form onSubmit={submit} style={{ marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8 }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share a prayer request…"
          required
          rows={3}
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 13 }}>
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          Submit anonymously
        </label>
        <button type="submit">Submit</button>
      </form>

      {prayer === null && <p>Loading…</p>}
      {prayer?.length === 0 && <p style={{ color: "#666" }}>No prayer requests yet.</p>}
      {prayer?.map((p) => {
        const isOwner = p.created_by === currentUserId;
        return (
          <div key={p.id} style={{ background: "#fff", borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <p style={{ margin: "0 0 8px", whiteSpace: "pre-wrap" }}>{p.body}</p>
            <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
              {p.is_anonymous ? "Anonymous" : p.users?.display_name} ·{" "}
              {new Date(p.created_at).toLocaleDateString()}
            </p>
            {(isOwner || canManage) && (
              <button onClick={() => remove(p.id)} style={{ marginTop: 8, fontSize: 12 }}>
                Remove
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
