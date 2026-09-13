"use client";

import { useEffect, useState, useCallback } from "react";

function PromotionQueue() {
  const [requests, setRequests] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/promotion-requests");
    const data = await res.json();
    if (res.ok) setRequests(data.requests);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id) => {
    await fetch(`/api/admin/promotion-requests/${id}/approve`, { method: "POST" });
    load();
  };
  const reject = async (id) => {
    await fetch(`/api/admin/promotion-requests/${id}/reject`, { method: "POST" });
    load();
  };

  if (!requests?.length) return null;

  return (
    <div style={{ marginBottom: 24, padding: 16, background: "#fff8e1", borderRadius: 8 }}>
      <h3 style={{ marginTop: 0 }}>Pending promotion requests</h3>
      {requests.map((r) => (
        <div key={r.id} style={{ background: "#fff", borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "#666" }}>
            From <strong>{r.groups?.name}</strong>, requested by {r.users?.display_name}
          </p>
          <h4 style={{ margin: "0 0 4px" }}>{r.news?.title}</h4>
          <p style={{ margin: "0 0 8px" }}>{r.news?.body}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => approve(r.id)}>Approve — push to church-wide</button>
            <button onClick={() => reject(r.id)}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NewsTab({ isAdmin }) {
  const [news, setNews] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/global/news");
    const data = await res.json();
    if (res.ok) setNews(data.news);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/global/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setTitle("");
    setBody("");
    load();
  };

  const remove = async (id) => {
    await fetch(`/api/global/news/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Church News</h2>

      {isAdmin && <PromotionQueue />}

      {isAdmin && (
        <form onSubmit={submit} style={{ marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            required
            style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's the announcement?"
            required
            rows={3}
            style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
          />
          <button type="submit">Post to everyone</button>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
        </form>
      )}

      {news === null && <p>Loading…</p>}
      {news?.length === 0 && <p style={{ color: "#666" }}>No announcements yet.</p>}
      {news?.map((n) => (
        <div key={n.id} style={{ background: "#fff", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <h3 style={{ margin: "0 0 4px" }}>{n.title}</h3>
          <p style={{ margin: "0 0 8px", whiteSpace: "pre-wrap" }}>{n.body}</p>
          <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
            {new Date(n.created_at).toLocaleDateString()}
            {n.users?.display_name && ` · ${n.users.display_name}`}
          </p>
          {isAdmin && (
            <button onClick={() => remove(n.id)} style={{ marginTop: 8, fontSize: 12 }}>
              Delete
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
