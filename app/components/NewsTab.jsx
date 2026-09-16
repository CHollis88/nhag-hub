"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, Pencil } from "lucide-react";
import { SkeletonList } from "./Skeleton";

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
    <div className="sp-card mb-4" style={{ background: "rgb(var(--color-accent) / 0.06)" }}>
      <h3 className="font-serif text-lg text-ink mt-0 mb-2">Pending promotion requests</h3>
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="sp-card">
            <p className="text-xs text-inkfaint mb-1">
              From <strong className="text-ink">{r.groups?.name}</strong>, requested by {r.users?.display_name}
            </p>
            <h4 className="font-medium text-ink mb-1">{r.news?.title}</h4>
            <p className="text-sm text-inksoft mb-2">{r.news?.body}</p>
            <div className="flex gap-2">
              <button onClick={() => approve(r.id)} className="sp-btn-sage text-xs py-1.5 px-3">
                Approve — push to church-wide
              </button>
              <button onClick={() => reject(r.id)} className="sp-btn-secondary text-xs py-1.5 px-3">
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NewsTab({ isAdmin }) {
  const [news, setNews] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("announcement");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [query, setQuery] = useState("");

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
      body: JSON.stringify({ title, body, category }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setTitle("");
    setBody("");
    setCategory("announcement");
    setShowForm(false);
    load();
  };

  const remove = async (id) => {
    await fetch(`/api/global/news/${id}`, { method: "DELETE" });
    load();
  };

  const togglePin = async (id, pinned) => {
    await fetch(`/api/global/news/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !pinned }),
    });
    load();
  };

  const startEdit = (n) => {
    setEditingId(n.id);
    setEditTitle(n.title);
    setEditBody(n.body);
  };

  const saveEdit = async (id) => {
    await fetch(`/api/global/news/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, body: editBody }),
    });
    setEditingId(null);
    load();
  };

  const filtered = useMemo(() => {
    if (!news) return [];
    if (!query.trim()) return news;
    const q = query.toLowerCase();
    return news.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
  }, [news, query]);

  return (
    <div className="px-5 pt-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-2xl text-ink">Church News</h2>
        {isAdmin && (
          <button onClick={() => setShowForm((s) => !s)} className="sp-btn-pill">
            {showForm ? "Cancel" : "+ Add"}
          </button>
        )}
      </div>

      {isAdmin && <PromotionQueue />}

      {isAdmin && showForm && (
        <form onSubmit={submit} className="sp-card mb-4">
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setCategory("announcement")}
              className={category === "announcement" ? "sp-pill-outline active" : "sp-pill-outline"}
            >
              Announcement
            </button>
            <button
              type="button"
              onClick={() => setCategory("pastor_message")}
              className={category === "pastor_message" ? "sp-pill-outline active" : "sp-pill-outline"}
            >
              Message from the Pastor
            </button>
          </div>
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
          <button type="submit" className="sp-btn-primary">Post to everyone</button>
          {error && <p className="text-sm mt-2 text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}

      {news === null && <SkeletonList count={3} />}
      {news !== null && (
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search News..."
            className="sp-input pl-9"
          />
        </div>
      )}
      {news?.length === 0 && <p className="text-sm text-inkfaint">No announcements yet.</p>}
      {news?.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-inkfaint">No News matches that search.</p>
      )}
      <div className="space-y-2">
        {filtered.map((n) => {
          const isEditing = editingId === n.id;
          return (
          <div key={n.id} className={`sp-card ${n.pinned ? "border-accent/40" : ""}`}>
            {isEditing ? (
              <>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="sp-input mb-2" />
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={3}
                  className="sp-textarea mb-2"
                />
                <div className="flex gap-3">
                  <button onClick={() => saveEdit(n.id)} className="sp-btn-primary py-1.5 px-3 text-sm">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-inkfaint underline">Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {n.pinned && (
                    <span className="text-[0.625rem] uppercase tracking-wide bg-accent text-white rounded-full px-2 py-0.5 font-semibold">
                      📌 Pinned
                    </span>
                  )}
                  {n.category === "pastor_message" && (
                    <span className="text-[0.625rem] uppercase tracking-wide bg-accent/10 text-accent rounded-full px-2 py-0.5 font-semibold">
                      Pastor's Message
                    </span>
                  )}
                  <h3 className="font-medium text-ink">{n.title}</h3>
                </div>
                <p className="text-sm text-inksoft whitespace-pre-wrap mb-2">{n.body}</p>
                <p className="text-xs text-inkfaint">
                  {new Date(n.created_at).toLocaleDateString()}
                  {n.users?.display_name && ` · ${n.users.display_name}`}
                </p>
                {isAdmin && (
                  <div className="flex gap-3 mt-2 flex-wrap">
                    <button onClick={() => startEdit(n)} className="text-xs text-accent underline flex items-center gap-1">
                      <Pencil size={11} /> Edit
                    </button>
                    <button onClick={() => togglePin(n.id, n.pinned)} className="text-xs text-accent underline">
                      {n.pinned ? "Unpin" : "Pin to top"}
                    </button>
                    <button onClick={() => remove(n.id)} className="text-xs text-inkfaint underline">
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
