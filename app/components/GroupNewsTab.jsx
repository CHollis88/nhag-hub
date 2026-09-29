"use client";

import { authorName } from "@/lib/authorName";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, Pencil } from "lucide-react";
import { SkeletonList } from "./Skeleton";
import PostReactions from "./PostReactions";
import EmptyState from "./EmptyState";
import { requestJson } from "@/lib/request";
import { useFormDisclosure } from "./useFormDisclosure";
import { useResource } from "@/lib/useResource";
import { STALE, invalidate } from "@/lib/resourceCache";
import { useScreenState, useScrollMemory } from "@/lib/useScreenState";
import { useAction } from "./useAction";
import { useToast } from "./ToastProvider";

function ReplyThread({ groupId, newsId }) {
  const [replies, setReplies] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const run = useAction();

  const load = useCallback(async () => {
    try {
      const data = await requestJson(`/api/groups/${groupId}/news/${newsId}/replies`);
      setReplies(data.replies);
    } catch {
      setReplies((prev) => prev ?? []);
    }
  }, [groupId, newsId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    // The reply stays in the box unless it actually posted.
    const { ok } = await run(() =>
      requestJson(`/api/groups/${groupId}/news/${newsId}/replies`, { method: "POST", body: { body: text } })
    );
    setSending(false);
    if (ok) {
      setText("");
      load();
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-linesoft">
      {replies?.map((r) => (
        <div key={r.id} className="text-sm text-inksoft mb-1.5">
          <strong className="text-ink">{authorName(r.users)}:</strong> {r.body}
        </div>
      ))}
      <form onSubmit={submit} className="flex gap-1.5 mt-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply…"
          className="sp-input text-sm py-1.5"
        />
        <button type="submit" disabled={sending || !text.trim()} aria-busy={sending || undefined} className="sp-btn-secondary text-sm py-1.5 px-3 disabled:opacity-60">
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}

const KIND_LABELS = {
  announcement: null, // no badge -- the plain, default case
  class: { text: "Class", className: "bg-sage/15 text-sage" },
  discuss: { text: "Discuss", className: "bg-navy/10 text-navy dark:bg-blue-400/15 dark:text-blue-300" },
  leader: { text: "Leaders Only", className: "bg-accent/15 text-accent" },
};

const FORM_COPY = {
  announcement: { heading: "New post", title: "Title", body: "What's the news?" },
  class: { heading: "New class notes", title: "Class title (e.g. this week's topic)", body: "Drop your notes from class here" },
  discuss: { heading: "New discussion", title: "Discussion title (e.g. a passage)", body: "Questions for the group to discuss" },
  leader: { heading: "New leaders-only post", title: "Title", body: "Only this group's leaders and admins will see this" },
};

export default function GroupNewsTab({ groupId, canManage, showClassOption = true }) {
  const [formKind, setFormKind] = useState(null); // null | "announcement" | "class" | "discuss" | "leader"
  // v71 #36: ONE form at a time -- a new post of some kind OR editing one. The
  // first field is focused on open (and scrolled to), and focus returns to the
  // button that opened it when it closes.
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [openThread, setOpenThread] = useState(null);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const form = useFormDisclosure(formKind ? `new:${formKind}` : editingId ? `edit:${editingId}` : "none");
  const openKind = (kind, fromElement) => {
    setEditingId(null);
    setFormKind(kind);
    form.show(fromElement);
  };
  const closeForms = () => {
    setFormKind(null);
    setEditingId(null);
    form.hide();
  };
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  // v71 #43: the search text and Drafts/published view are remembered when you leave and return.
  const [query, setQuery] = useScreenState(`news:${groupId}:query`, "");
  const [viewMode, setViewMode] = useScreenState(`news:${groupId}:view`, "published"); // "published" | "drafts" -- leader-only toggle
  const [notify, setNotify] = useState(true);

  const newsUrl = `/api/groups/${groupId}/news`;
  const run = useAction();
  const toast = useToast();

  // v71 #42-45: through the shared cache (shown at once on return, refreshed
  // quietly when stale). After any change: every cached view of this news
  // goes stale and the one on screen refreshes.
  const newsPrefix = `group:${groupId}:news:`;
  const { data: news, error: newsError } = useResource(
    `${newsPrefix}${viewMode}`,
    async () => (await requestJson(`${newsUrl}${viewMode === "drafts" ? "?drafts=1" : ""}`)).news,
    { staleMs: STALE.list }
  );
  const loadFailed = Boolean(newsError);
  const load = () => invalidate(`${newsPrefix}*`);
  const scrollAnchor = useScrollMemory(`news:${groupId}`, news !== null);

  // Only clears/closes the form on success; on failure everything typed
  // stays and the reason is shown.
  const submit = async (e, asDraft = false) => {
    e.preventDefault();
    try {
      await requestJson(newsUrl, {
        method: "POST",
        body: { title, body, kind: formKind, status: asDraft ? "draft" : "published", notify },
      });
    } catch (err) {
      toast.error(err.message);
      return;
    }
    toast.success(asDraft ? "Draft saved" : "Posted");
    setTitle("");
    setBody("");
    closeForms();
    setNotify(true);
    load();
  };

  const publish = async (id) => {
    const { ok } = await run(() => requestJson(`${newsUrl}/${id}`, { method: "PATCH", body: { status: "published" } }), {
      success: "Published",
    });
    if (ok) load();
  };

  const remove = async (id) => {
    const { ok } = await run(() => requestJson(`${newsUrl}/${id}`, { method: "DELETE" }), { success: "Post deleted" });
    if (ok) load();
  };

  const togglePin = async (id, pinned) => {
    const { ok } = await run(() => requestJson(`${newsUrl}/${id}`, { method: "PATCH", body: { pinned: !pinned } }));
    if (ok) load();
  };

  const startEdit = (n, fromElement) => {
    setFormKind(null);
    setEditingId(n.id);
    form.show(fromElement);
    setEditTitle(n.title);
    setEditBody(n.body);
  };

  // The edit stays open (with the changes still in it) if saving fails.
  const saveEdit = async (id) => {
    const { ok } = await run(
      () => requestJson(`${newsUrl}/${id}`, { method: "PATCH", body: { title: editTitle, body: editBody } }),
      { success: "Saved" }
    );
    if (ok) {
      closeForms();
      load();
    }
  };

  // Asks a Church Admin to push this post to the church-wide feed. The
  // outcome shows in the message line (and a toast), success or failure.
  const requestPromotion = async (id) => {
    setMessage("");
    try {
      await requestJson(`${newsUrl}/${id}/promote`, { method: "POST" });
      setMessage("Sent to Church Admin for approval.");
      toast.success("Sent to Church Admin for approval");
    } catch (err) {
      setMessage(err.message);
    }
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
      <div ref={scrollAnchor} />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-serif text-2xl text-ink">{viewMode === "drafts" ? "Drafts" : "Group News"}</h2>
        {canManage && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setViewMode(viewMode === "drafts" ? "published" : "drafts")}
              className="sp-btn-secondary text-sm py-1.5 px-3"
            >
              {viewMode === "drafts" ? "Back to News" : "Drafts"}
            </button>
            {showClassOption && (
              <button onClick={(e) => openKind("class", e.currentTarget)} className="sp-btn-pill bg-sage">
                Class
              </button>
            )}
            <button onClick={(e) => openKind("discuss", e.currentTarget)} className="sp-btn-pill bg-navy">
              Discuss
            </button>
            <button onClick={(e) => openKind("announcement", e.currentTarget)} className="sp-btn-pill">
              Post
            </button>
            <button onClick={(e) => openKind("leader", e.currentTarget)} className="sp-btn-pill bg-accent">
              Leaders Only
            </button>
          </div>
        )}
      </div>

      {formKind && (
        <form ref={form.formRef} onSubmit={submit} className="sp-card mb-4" aria-labelledby="new-news-heading">
          <h3 id="new-news-heading" className="font-serif text-lg text-ink mt-0 mb-3">{copy.heading}</h3>
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
          <label className="flex items-center gap-2 mb-2 text-sm text-inksoft">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Notify {formKind === "leader" ? "this group's leaders" : "the group"}
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={closeForms} className="sp-btn-secondary flex-1">Cancel</button>
            <button type="button" onClick={(e) => submit(e, true)} className="sp-btn-secondary flex-1">Save as Draft</button>
            <button type="submit" className="sp-btn-primary flex-1">Post</button>
          </div>
        </form>
      )}

      {news === null && loadFailed && <EmptyState kind="error" text="Couldn't load posts." onRetry={load} />}
      {news === null && !loadFailed && <SkeletonList count={3} />}
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
                <div ref={form.formRef} role="group" aria-label="Edit post">
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="sp-input mb-2" />
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    className="sp-textarea mb-2"
                  />
                  <div className="flex gap-3">
                    <button onClick={() => saveEdit(n.id)} className="sp-btn-primary py-1.5 px-3 text-sm">Save</button>
                    <button onClick={closeForms} className="text-xs text-inkfaint underline">Cancel</button>
                  </div>
                </div>
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
                        <button onClick={(e) => startEdit(n, e.currentTarget)} data-return-focus={`news-edit-${n.id}`} className="text-xs text-accent underline flex items-center gap-1">
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
                        {n.kind !== "class" && n.status !== "draft" && (
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

                  {n.status !== "draft" && <PostReactions postType="group_news" postId={n.id} />}

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
