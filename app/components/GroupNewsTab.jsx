"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, Pencil } from "lucide-react";
import { SkeletonList } from "./Skeleton";

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

const KIND_LABELS = {
  announcement: null, // no badge -- the plain, default case
  class: { text: "Class", className: "bg-sage/15 text-sage" },
  discuss: { text: "Discuss", className: "bg-navy/10 text-navy dark:bg-blue-400/15 dark:text-blue-300" },
};

const FORM_COPY = {
  announcement: { title: "Title", body: "What's the news?" },
  class: { title: "Class title (e.g. this week's topic)", body: "Drop your notes from class here" },
  discuss: { title: "Discussion title (e.g. a passage)", body: "Questions for the group to discuss" },
};

export default function GroupNewsTab({ groupId, canManage, showClassOption = true }) {
  const [news, setNews] = useState(null);
  const [formKind, setFormKind] = useState(null); // null | "announcement" | "class" | "discuss"
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [openThread, setOpenThread] = useState(null);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [query, setQuery] = useState("");

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
      body: JSON.stringify({ title, body, kind: formKind }),
    });
    if (res.ok) {
      setTitle("");
      setBody("");
      setFormKind(null);
      load();
    }
  };

  const remove = async (id) => {
    await fetch(`/api/groups/${groupId}/news/${id}`, { method: "DELETE" });
    load();
  };

  const togglePin = async (id, pinned) => {
    await fetch(`/api/groups/${groupId}/news/${id}`, {
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
    await fetch(`/api/groups/${groupId}/news/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, body: editBody }),
    });
    setEditingId(null);
    load();
  };

  const requestPromotion = async (id) => {
    setMessage("");
    const res = await fetch(`/api/groups/${groupId}/news/${id}/promote`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? "Sent to Church Admin for approval." : data.error);
  };

  const filtered = useMemo(() => {
    if (!news) return [];
    if (!query.trim()) return news;
    const q = query.toLowerCase();
    return news.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
  }, [news, query]);

  const copy = formKind ? FORM_COPY[formKind] : null;

  return (
    <div className="px-5 pt-4 pb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-serif text-2xl text-ink">Group News</h2>
        {canManage && (
          <div className="flex gap-2 flex-wrap">
            {showClassOption && (
              <button onClick={() => setFormKind("class")} className="sp-btn-pill bg-sage">
                Class
              </button>
            )}
            <button onClick={() => setFormKind("discuss")} className="sp-btn-pill bg-navy">
              Discuss
            </button>
            <button onClick={() => setFormKind("announcement")} className="sp-btn-pill">
              Post
            </button>
          </div>
        )}
      </div>

      {formKind && (
        <form onSubmit={submit} className="sp-card mb-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={copy.title}
            required
            className="sp-input mb-2"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={copy.body}
            required
            rows={formKind === "class" ? 6 : 3}
            className="sp-textarea mb-2"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setFormKind(null)} className="sp-btn-secondary flex-1">Cancel</button>
            <button type="submit" className="sp-btn-primary flex-1">Post</button>
          </div>
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
      {news?.length === 0 && <p className="text-sm text-inkfaint">No news yet.</p>}
      {news?.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-inkfaint">No News matches that search.</p>
      )}
      <div className="space-y-2">
        {filtered.map((n) => {
          const badge = KIND_LABELS[n.kind];
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
                    {badge && (
                      <span className={`text-[0.625rem] uppercase tracking-wide rounded-full px-2 py-0.5 font-semibold ${badge.className}`}>
                        {badge.text}
                      </span>
                    )}
                    <h3 className="font-medium text-ink">{n.title}</h3>
                  </div>
                  <p className="text-sm text-inksoft whitespace-pre-wrap mb-2">{n.body}</p>
                  <p className="text-xs text-inkfaint">
                    {new Date(n.created_at).toLocaleDateString()}
                    {n.users?.display_name && ` · ${n.users.display_name}`}
                  </p>

                  <div className="flex gap-3 mt-2 flex-wrap">
                    {n.kind === "discuss" && (
                      <button onClick={() => setOpenThread(openThread === n.id ? null : n.id)} className="text-xs text-accent underline">
                        {openThread === n.id ? "Hide replies" : "Replies"}
                      </button>
                    )}
                    {canManage && (
                      <>
                        <button onClick={() => startEdit(n)} className="text-xs text-accent underline flex items-center gap-1">
                          <Pencil size={11} /> Edit
                        </button>
                        <button onClick={() => togglePin(n.id, n.pinned)} className="text-xs text-accent underline">
                          {n.pinned ? "Unpin" : "Pin to top"}
                        </button>
                        {n.kind !== "class" && (
                          <button onClick={() => requestPromotion(n.id)} className="text-xs text-accent underline">
                            Request promote to church-wide
                          </button>
                        )}
                        <button onClick={() => remove(n.id)} className="text-xs text-inkfaint underline">
                          Delete
                        </button>
                      </>
                    )}
                  </div>

                  {n.kind === "discuss" && openThread === n.id && <ReplyThread groupId={groupId} newsId={n.id} />}
                </>
              )}
            </div>
          );
        })}
      </div>

      {message && <p className="text-sm text-inksoft mt-3">{message}</p>}
    </div>
  );
}
