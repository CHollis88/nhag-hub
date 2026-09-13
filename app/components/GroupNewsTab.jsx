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
    <div className="mt-3 pt-3 border-t border-linesoft">
      {replies?.map((r) => (
        <div key={r.id} className="text-sm text-inksoft mb-1.5">
          <strong className="text-ink">{r.users?.display_name}:</strong> {r.body}
        </div>
      ))}
      <form onSubmit={submit} className="flex gap-1.5 mt-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply…"
          className="sp-input text-sm py-1.5"
        />
        <button type="submit" className="sp-btn-secondary text-sm py-1.5 px-3">Send</button>
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
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-4">Group News</h2>

      {canManage && (
        <form onSubmit={submit} className="sp-card mb-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            required
            className="sp-input mb-2"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's the news?"
            required
            rows={3}
            className="sp-textarea mb-2"
          />
          <button type="submit" className="sp-btn-primary">Post to group</button>
        </form>
      )}

      {news === null && <p className="text-sm text-inkfaint">Loading…</p>}
      {news?.length === 0 && <p className="text-sm text-inkfaint">No news yet.</p>}
      <div className="space-y-2">
        {news?.map((n) => (
          <div key={n.id} className="sp-card">
            <h3 className="font-medium text-ink mb-1">{n.title}</h3>
            <p className="text-sm text-inksoft whitespace-pre-wrap mb-2">{n.body}</p>
            <p className="text-xs text-inkfaint">
              {new Date(n.created_at).toLocaleDateString()}
              {n.users?.display_name && ` · ${n.users.display_name}`}
            </p>

            <div className="flex gap-3 mt-2">
              <button onClick={() => setOpenThread(openThread === n.id ? null : n.id)} className="text-xs text-accent underline">
                {openThread === n.id ? "Hide replies" : "Replies"}
              </button>
              {canManage && (
                <>
                  <button onClick={() => requestPromotion(n.id)} className="text-xs text-accent underline">
                    Request promote to church-wide
                  </button>
                  <button onClick={() => remove(n.id)} className="text-xs text-inkfaint underline">
                    Delete
                  </button>
                </>
              )}
            </div>

            {openThread === n.id && <ReplyThread groupId={groupId} newsId={n.id} />}
          </div>
        ))}
      </div>

      {message && <p className="text-sm text-inksoft mt-3">{message}</p>}
    </div>
  );
}
