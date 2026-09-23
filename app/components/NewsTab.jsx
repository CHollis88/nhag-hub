"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, Pencil } from "lucide-react";
import { SkeletonList } from "./Skeleton";
import PostReactions from "./PostReactions";

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

export default function NewsTab({ isAdmin, isAnyLeader }) {
  const [news, setNews] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("announcement");
  const [audience, setAudience] = useState(isAdmin ? "everyone" : "leaders");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState("published"); // admin-only "Drafts" toggle
  const [notify, setNotify] = useState(true);

  // Anyone who can post at all -- an admin (the 'everyone' audience) or
  // any ministry leader (the 'leaders' audience, migration_024).
  const canPostAnything = isAdmin || isAnyLeader;

  const load = useCallback(async () => {
    const res = await fetch(`/api/global/news${viewMode === "drafts" ? "?drafts=1" : ""}`);
    const data = await res.json();
    if (res.ok) setNews(data.news);
  }, [viewMode]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e, asDraft = false) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/global/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, category, audience, status: asDraft ? "draft" : "published", notify }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setTitle("");
    setBody("");
    setCategory("announcement");
    setAudience(isAdmin ? "everyone" : "leaders");
    setNotify(true);
    setShowForm(false);
    load();
  };

  const publish = async (id) => {
    await fetch(`/api/global/news/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
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
        <h2 className="font-serif text-2xl text-ink">{viewMode === "drafts" ? "Drafts" : "Church News"}</h2>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => setViewMode(viewMode === "drafts" ? "published" : "drafts")}
              className="sp-btn-secondary text-sm py-1.5 px-3"
            >
              {viewMode === "drafts" ? "Back to News" : "Drafts"}
            </button>
          )}
          {canPostAnything && (
            <button onClick={() => setShowForm((s) => !s)} className="sp-btn-pill">
              {showForm ? "Cancel" : "+ Add"}
            </button>
          )}
        </div>
      </div>

      {isAdmin && <PromotionQueue />}

      {canPostAnything && showForm && (
        <form onSubmit={submit} className="sp-card mb-4">
          {/* Audience picker only shown when there's an actual choice --
              an admin can post either way; a leader who isn't an admin
              can ONLY post to the leaders channel, so there's no
              decision to make and no picker to show them. */}
          {isAdmin && isAnyLeader && (
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setAudience("everyone")}
                className={audience === "everyone" ? "sp-pill-outline active" : "sp-pill-outline"}
              >
                Everyone
              </button>
              <button
                type="button"
                onClick={() => setAudience("leaders")}
                className={audience === "leaders" ? "sp-pill-outline active" : "sp-pill-outline"}
              >
                Leaders Only
              </button>
            </div>
          )}
          {isAdmin && !isAnyLeader && audience === "leaders" && setAudience("everyone")}
          {!isAdmin && (
            <p className="text-xs text-inkfaint mb-2">
              Posting to the church-wide leaders channel — visible to every ministry leader and admin.
            </p>
          )}
          {isAdmin && audience === "everyone" && (
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
          )}
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
          <label className="flex items-center gap-2 mb-2 text-sm text-inksoft">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Notify {audience === "leaders" ? "leaders" : "everyone"}
          </label>
          <div className="flex gap-2">
            {isAdmin && (
              <button type="button" onClick={(e) => submit(e, true)} className="sp-btn-secondary flex-1">
                Save as Draft
              </button>
            )}
            <button type="submit" className="sp-btn-primary flex-1">
              {audience === "leaders" ? "Post to leaders" : "Post to everyone"}
            </button>
          </div>
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
                  {n.audience === "leaders" && (
                    <span className="text-[0.625rem] uppercase tracking-wide bg-accent text-white rounded-full px-2 py-0.5 font-semibold">
                      Leaders Only
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
                    {n.status === "draft" ? (
                      <button onClick={() => publish(n.id)} className="text-xs text-sage underline font-semibold">
                        Publish
                      </button>
                    ) : (
                      <button onClick={() => togglePin(n.id, n.pinned)} className="text-xs text-accent underline">
                        {n.pinned ? "Unpin" : "Pin to top"}
                      </button>
                    )}
                    <button onClick={() => remove(n.id)} className="text-xs text-inkfaint underline">
                      Delete
                    </button>
                  </div>
                )}
                {n.status !== "draft" && <PostReactions postType="global_news" postId={n.id} />}
              </>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
