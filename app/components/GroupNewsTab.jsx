"use client";

import { useEffect, useState, useCallback } from "react";

function ReplyThread({ groupId, newsId }) {
  const [replies, setReplies] = useState(null);
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/news/${newsId}/replies`);
    const data = await res.json();
    if (res.ok) setReplies(data.replies);
  }, [groupId, newsId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await fetch(`/api/groups/${groupId}/news/${newsId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    setText("");
    load();
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
      {replies?.map((r) => (
        <div key={r.id} style={{ fontSize: 13, marginBottom: 6 }}>
          <strong>{r.users?.display_name}:</strong> {r.body}
        </div>
      ))}
      <form onSubmit={submit} style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply…"
          style={{ flex: 1, padding: 6, fontSize: 13 }}
        />
        <button type="submit" style={{ fontSize: 13 }}>Send</button>
      </form>
    </div>
  );
}

export default function GroupNewsTab({ groupId, canManage }) {
  const [news, setNews] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [openThread, setOpenThread] = useState(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/news`);
    const data = await res.json();
    if (res.ok) setNews(data.news);
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/groups/${groupId}/news`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    if (res.ok) {
      setTitle("");
      setBody("");
      load();
    }
  };

  const remove = async (id) => {
    await fetch(`/api/groups/${groupId}/news/${id}`, { method: "DELETE" });
    load();
  };

  const requestPromotion = async (id) => {
    setMessage("");
    const res = await fetch(`/api/groups/${groupId}/news/${id}/promote`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? "Sent to Church Admin for approval." : data.error);
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Group News</h2>

      {canManage && (
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
            placeholder="What's the news?"
            required
            rows={3}
            style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
          />
          <button type="submit">Post to group</button>
        </form>
      )}

      {news === null && <p>Loading…</p>}
      {news?.length === 0 && <p style={{ color: "#666" }}>No news yet.</p>}
      {news?.map((n) => (
        <div key={n.id} style={{ background: "#fff", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <h3 style={{ margin: "0 0 4px" }}>{n.title}</h3>
          <p style={{ margin: "0 0 8px", whiteSpace: "pre-wrap" }}>{n.body}</p>
          <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
            {new Date(n.created_at).toLocaleDateString()}
            {n.users?.display_name && ` · ${n.users.display_name}`}
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button onClick={() => setOpenThread(openThread === n.id ? null : n.id)} style={{ fontSize: 12 }}>
              {openThread === n.id ? "Hide replies" : "Replies"}
            </button>
            {canManage && (
              <>
                <button onClick={() => requestPromotion(n.id)} style={{ fontSize: 12 }}>
                  Request promote to church-wide
                </button>
                <button onClick={() => remove(n.id)} style={{ fontSize: 12 }}>
                  Delete
                </button>
              </>
            )}
          </div>

          {openThread === n.id && <ReplyThread groupId={groupId} newsId={n.id} />}
        </div>
      ))}

      {message && <p style={{ color: "#666", fontSize: 13 }}>{message}</p>}
    </div>
  );
}
