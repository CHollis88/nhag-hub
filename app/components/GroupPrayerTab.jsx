"use client";

import { authorName } from "@/lib/authorName";
import { useState, useRef } from "react";
import { Heart, Pencil, RefreshCw } from "lucide-react";
import { SkeletonList } from "./Skeleton";
import PostReactions from "./PostReactions";
import EmptyState from "./EmptyState";
import { useAction } from "./useAction";
import { requestJson, errorMessage } from "@/lib/request";
import { useFormDisclosure } from "./useFormDisclosure";
import { useResource } from "@/lib/useResource";
import { STALE, invalidate } from "@/lib/resourceCache";
import { useScrollMemory } from "@/lib/useScreenState";

const STATUS_LABEL = { open: null, answered: "Answered 🙏", "still-praying": "Still Praying" };

export default function GroupPrayerTab({ groupId, canManage }) {
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [notify, setNotify] = useState(true);
  const [editingId, setEditingId] = useState(null);
  // v71 #36: editing a request focuses its text box, and focus returns to the
  // "Edit" button afterwards.
  const form = useFormDisclosure(editingId ?? "none");
  const closeEdit = () => {
    setEditingId(null);
    form.hide();
  };
  const [editBody, setEditBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const prayingRef = useRef(new Set());
  const run = useAction();

  // v71 #42-45: through the shared cache; the pray-toggle and status changes
  // below edit the cached list in place (setPrayer).
  const prayerKey = `group:${groupId}:prayer`;
  const { data: prayer, error: prayerError, setData: setPrayer } = useResource(
    prayerKey,
    async () => (await requestJson(`/api/groups/${groupId}/prayer`)).prayer,
    { staleMs: STALE.list }
  );
  // A failed load used to leave the screen stuck on "Loading…" forever with no
  // explanation -- it says what went wrong and offers a retry.
  const loadError = prayerError ? errorMessage(prayerError, "Couldn't load prayer requests.") : "";
  const load = () => invalidate(prayerKey);
  const scrollAnchor = useScrollMemory(`prayer:${groupId}`, prayer !== null);

  // On failure the request text stays in the box (and an edit stays open),
  // so nothing has to be retyped; only a success clears/closes it.
  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    const { ok } = await run(
      () => requestJson(`/api/groups/${groupId}/prayer`, { method: "POST", body: { body, is_anonymous: anonymous, notify } }),
      { success: "Prayer request shared" }
    );
    setSubmitting(false);
    if (ok) {
      setBody("");
      setAnonymous(false);
      setNotify(true);
      load();
    }
  };

  const remove = async (id) => {
    const { ok } = await run(() => requestJson(`/api/groups/${groupId}/prayer/${id}`, { method: "DELETE" }), {
      success: "Prayer request removed",
    });
    if (ok) load();
  };

  const startEdit = (p, fromElement) => {
    setEditingId(p.id);
    form.show(fromElement);
    setEditBody(p.body);
  };

  const saveEdit = async (id) => {
    if (!editBody.trim()) return;
    const { ok } = await run(
      () => requestJson(`/api/groups/${groupId}/prayer/${id}`, { method: "PATCH", body: { body: editBody } }),
      { success: "Saved" }
    );
    if (ok) {
      closeEdit();
      load();
    }
  };

  // Only the original author sees these controls (checked via p.is_mine
  // server-side already stripping identity for anonymous requests).
  // Optimistic, and put back exactly as it was if the server says no.
  const setStatus = async (id, status) => {
    const before = prayer.find((p) => p.id === id)?.status;
    setPrayer((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    const { ok } = await run(() =>
      requestJson(`/api/groups/${groupId}/prayer/${id}/status`, { method: "PATCH", body: { status } })
    );
    if (!ok) setPrayer((prev) => prev.map((p) => (p.id === id ? { ...p, status: before } : p)));
    else load();
  };

  // v71 #12: optimistic so the tap feels instant, but the SERVER's answer
  // is what's kept -- it returns the authoritative i_prayed + pray_count
  // (toggled atomically in the database), so two people tapping at once
  // can't leave the count wrong. A failure puts the card back exactly as
  // it was, and a second tap while one is in flight is ignored (a fast
  // double-tap used to send two toggles and end up back where it started).
  const pray = async (id) => {
    if (prayingRef.current.has(id)) return;
    const before = prayer.find((p) => p.id === id);
    if (!before) return;
    prayingRef.current.add(id);
    setPrayer((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, i_prayed: !p.i_prayed, pray_count: Math.max(0, (p.pray_count || 0) + (p.i_prayed ? -1 : 1)) }
          : p
      )
    );
    const { ok, data } = await run(() => requestJson(`/api/groups/${groupId}/prayer/${id}/pray`, { method: "POST" }));
    prayingRef.current.delete(id);
    setPrayer((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (!ok) return { ...p, i_prayed: before.i_prayed, pray_count: before.pray_count };
        return { ...p, i_prayed: data.i_prayed, pray_count: data.pray_count };
      })
    );
  };

  return (
    <div className="px-5 pt-4 pb-6">
      <div ref={scrollAnchor} />
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-2xl text-ink">Prayer Requests</h2>
        <button onClick={load} aria-label="Refresh" title="Refresh" className="text-inkfaint p-1">
          <RefreshCw size={16} />
        </button>
      </div>

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
        <label className="flex items-center gap-2 mb-2 text-sm text-inksoft">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Notify the group
        </label>
        <button type="submit" disabled={submitting || !body.trim()} aria-busy={submitting || undefined} className="sp-btn-primary disabled:opacity-60">
          {submitting ? "Sharing…" : "Submit"}
        </button>
      </form>

      {prayer === null && !loadError && <SkeletonList count={3} />}
      {loadError && (
        <div className="sp-card border-red-200 dark:border-red-900 mb-2">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{loadError}</p>
          <button onClick={load} className="sp-btn-secondary py-1.5 px-3 text-sm flex items-center gap-1.5 w-fit">
            <RefreshCw size={13} /> Try again
          </button>
        </div>
      )}
      {prayer?.length === 0 && <EmptyState icon={Heart} text="No prayer requests yet." />}
      <div className="space-y-2">
        {prayer?.map((p) => {
          const isEditing = editingId === p.id;
          return (
            <div key={p.id} className="sp-card">
              {isEditing ? (
                <div ref={form.formRef} role="group" aria-label="Edit prayer request">
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    className="sp-textarea mb-2"
                  />
                  <div className="flex gap-3">
                    <button onClick={() => saveEdit(p.id)} className="sp-btn-primary py-1.5 px-3 text-sm">
                      Save
                    </button>
                    <button onClick={closeEdit} className="text-xs text-inkfaint underline">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-inksoft whitespace-pre-wrap mb-2">{p.body}</p>
                  {STATUS_LABEL[p.status] && (
                    <span className="inline-block text-xs font-semibold text-sage mb-2">{STATUS_LABEL[p.status]}</span>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-inkfaint">
                      {p.is_anonymous ? "Anonymous" : authorName(p.users)} ·{" "}
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => pray(p.id)}
                      aria-pressed={Boolean(p.i_prayed)}
                      className={`sp-pill-outline ${p.i_prayed ? "active" : ""}`}
                    >
                      <Heart size={12} fill={p.i_prayed ? "rgb(var(--color-sage))" : "none"} />
                      {p.i_prayed ? "Praying" : "I'm praying"} · {p.pray_count || 0}
                    </button>
                  </div>
                  <PostReactions postType="group_prayer" postId={p.id} />
                  {p.is_mine && (
                    <div className="flex gap-2 mt-2">
                      {p.status !== "still-praying" && (
                        <button onClick={() => setStatus(p.id, "still-praying")} className="sp-pill-outline text-xs">
                          Still Praying
                        </button>
                      )}
                      {p.status !== "answered" && (
                        <button onClick={() => setStatus(p.id, "answered")} className="sp-pill-outline text-xs">
                          Mark Answered
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex gap-3 mt-2">
                    {p.is_mine && (
                      <button onClick={(e) => startEdit(p, e.currentTarget)} data-return-focus={`prayer-edit-${p.id}`} className="text-xs text-accent underline flex items-center gap-1">
                        <Pencil size={11} /> Edit
                      </button>
                    )}
                    {(p.is_mine || canManage) && (
                      <button onClick={() => remove(p.id)} className="text-xs text-inkfaint underline">
                        Remove
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
