"use client";

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

function PromotionQueue() {
  const [requests, setRequests] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const run = useAction();

  const load = useCallback(async () => {
    try {
      const data = await requestJson("/api/admin/promotion-requests");
      setRequests(data.requests);
    } catch {
      // Keeps whatever is showing; this queue simply stays hidden if empty.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // One at a time, and the list always refreshes so it shows what's true.
  const decide = async (id, action, success) => {
    if (busyId) return;
    setBusyId(id);
    await run(() => requestJson(`/api/admin/promotion-requests/${id}/${action}`, { method: "POST" }), { success });
    await load();
    setBusyId(null);
  };
  const approve = (id) => decide(id, "approve", "Approved — pushed church-wide");
  const reject = (id) => decide(id, "reject", "Request rejected");

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
              <button onClick={() => approve(r.id)} disabled={busyId === r.id} className="sp-btn-sage text-xs py-1.5 px-3 disabled:opacity-60">
                Approve — push to church-wide
              </button>
              <button onClick={() => reject(r.id)} disabled={busyId === r.id} className="sp-btn-secondary text-xs py-1.5 px-3 disabled:opacity-60">
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
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("announcement");
  // The audience the person PICKED. What actually applies is derived below
  // from their permissions (v71 #5) -- never corrected by setting state
  // during render.
  const [audienceChoice, setAudience] = useState(isAdmin ? "everyone" : "leaders");
  const [error, setError] = useState("");
  // v71 #36: ONE form at a time (a new post OR editing one), "+ Add" becomes
  // "Cancel", focus lands on the first field, and returns to what opened it.
  const [editingId, setEditingId] = useState(null);
  const form = useFormDisclosure(editingId ?? "new");
  const showForm = form.open && !editingId;
  const closeForm = () => {
    setEditingId(null);
    form.hide();
  };
  const openNew = () => {
    setEditingId(null);
    form.show();
  };
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  // v71 #43: search text and Drafts/published view are remembered when you leave and return.
  const [query, setQuery] = useScreenState("news:church:query", "");
  const [viewMode, setViewMode] = useScreenState("news:church:view", "published"); // admin-only "Drafts" toggle
  const [notify, setNotify] = useState(true);

  // Anyone who can post at all -- an admin (the 'everyone' audience) or
  // any ministry leader (the 'leaders' audience, migration_024).
  const canPostAnything = isAdmin || isAnyLeader;

  // Non-admin leaders can only post to the leaders channel; an admin who
  // isn't a leader has no choice to make and posts to everyone; someone
  // who is both picks between the two.
  const audience = !isAdmin ? "leaders" : !isAnyLeader ? "everyone" : audienceChoice;

  const newsUrl = "/api/global/news";
  const run = useAction();
  const toast = useToast();

  // v71 #42-45: through the shared cache.
  const { data: news, error: newsError } = useResource(
    `news:church:${viewMode}`,
    async () => (await requestJson(`${newsUrl}${viewMode === "drafts" ? "?drafts=1" : ""}`)).news,
    { staleMs: STALE.list }
  );
  const loadFailed = Boolean(newsError);
  const load = () => invalidate("news:church:*");
  const scrollAnchor = useScrollMemory("news:church", news !== null);

  // Only clears/closes the form on success; on failure everything typed
  // stays and the reason is shown.
  const submit = async (e, asDraft = false) => {
    e.preventDefault();
    setError("");
    try {
      await requestJson(newsUrl, {
        method: "POST",
        body: { title, body, category, audience, status: asDraft ? "draft" : "published", notify },
      });
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
      return;
    }
    toast.success(asDraft ? "Draft saved" : "Posted");
    setTitle("");
    setBody("");
      setCategory("announcement");
      setAudience(isAdmin ? "everyone" : "leaders");
    setNotify(true);
    closeForm();
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
      closeForm();
      load();
    }
  };

  const filtered = useMemo(() => {
    if (!news) return [];
    if (!query.trim()) return news;
    const q = query.toLowerCase();
    return news.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
  }, [news, query]);

  return (
    <div className="px-5 pt-4 pb-6">
      <div ref={scrollAnchor} />
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
            <button ref={form.triggerRef} onClick={() => (form.open ? closeForm() : openNew())} className="sp-btn-pill">
              {form.open ? "Cancel" : "+ Add"}
            </button>
          )}
        </div>
      </div>

      {isAdmin && <PromotionQueue />}

      {canPostAnything && showForm && (
        <form ref={form.formRef} onSubmit={submit} className="sp-card mb-4" aria-labelledby="new-church-news-heading">
          <h3 id="new-church-news-heading" className="font-serif text-lg text-ink mt-0 mb-3">New post</h3>
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
                  <button onClick={closeForm} className="text-xs text-inkfaint underline">Cancel</button>
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
