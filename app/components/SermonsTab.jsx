"use client";

import { useState, useMemo } from "react";
import { ExternalLink, Search, Mic, Pencil } from "lucide-react";
import SermonSeriesSheet from "./SermonSeriesSheet";
import { useFormDisclosure } from "./useFormDisclosure";
import EmptyState from "./EmptyState";
import { SkeletonList } from "./Skeleton";
import { useConfirm } from "./ConfirmDialog";
import { useToast } from "./ToastProvider";
import { useAction } from "./useAction";
import { requestJson } from "@/lib/request";
import { useResource } from "@/lib/useResource";
import { STALE, invalidate } from "@/lib/resourceCache";
import { useScreenState, useScrollMemory } from "@/lib/useScreenState";

function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function SermonsTab({ isAdmin }) {
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [sermonDate, setSermonDate] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [newSeriesName, setNewSeriesName] = useState("");
  const [seriesSheetOpen, setSeriesSheetOpen] = useState(false);
  const [error, setError] = useState("");
  const [notify, setNotify] = useState(true);
  const [editingId, setEditingId] = useState(null);
  // v71 #36: focus the first field on open, follow it if you switch to editing
  // another sermon, and return focus to what opened it when it closes.
  const form = useFormDisclosure(editingId);
  const showForm = form.open;
  const confirm = useConfirm();
  const run = useAction();
  const toast = useToast();

  // v71 #42-45: what you were looking at is remembered when you leave and come
  // back -- the search you typed, the series filter, Drafts vs published, and
  // how far you'd scrolled.
  const [query, setQuery] = useScreenState("sermons:query", "");
  const [filterSeriesId, setFilterSeriesId] = useScreenState("sermons:series", "");
  const [viewMode, setViewMode] = useScreenState("sermons:view", "published"); // admin-only "Drafts" toggle

  const listUrl = (() => {
    const params = new URLSearchParams();
    if (filterSeriesId) params.set("series_id", filterSeriesId);
    if (viewMode === "drafts") params.set("drafts", "1");
    const qs = params.toString();
    return `/api/sermons${qs ? `?${qs}` : ""}`;
  })();
  // The sermon list comes through the shared cache: coming back shows it at
  // once and refreshes it quietly if it has gone stale.
  const { data: sermons, error: sermonsError, refresh: load } = useResource(
    `sermons:${viewMode}:${filterSeriesId || "all"}`,
    async () => (await requestJson(listUrl)).sermons,
    { staleMs: STALE.list }
  );
  const loadFailed = Boolean(sermonsError);
  // The series list is a convenience; the sermons still show without it.
  const { data: seriesList } = useResource(
    "sermon-series",
    async () => (await requestJson("/api/sermon-series")).series,
    { staleMs: STALE.list }
  );
  const series = seriesList || [];
  // After any change: every cached sermon list goes stale (the one on screen
  // refreshes now) and so does the series list.
  const reload = () => {
    invalidate("sermons:*");
    invalidate("sermon-series");
  };
  const scrollAnchor = useScrollMemory("sermons", sermons !== null);

  const submit = async (e, asDraft = false) => {
    e.preventDefault();
    setError("");
    let finalSeriesId = seriesId;
    // Creating a new series inline is the only path -- no separate
    // "manage series" screen, since a series is really just a label
    // applied while posting a sermon.
    if (!finalSeriesId && newSeriesName.trim()) {
      // v71 #8: if the series can't be created, STOP and say so. It used to
      // carry on and post the sermon with no series, silently.
      try {
        const seriesData = await requestJson("/api/sermon-series", { method: "POST", body: { name: newSeriesName.trim() } });
        finalSeriesId = seriesData.series.id;
        // If the sermon itself then fails, a retry must reuse this series
        // rather than trying to create it a second time.
        setSeriesId(finalSeriesId);
        setNewSeriesName("");
      } catch (err) {
        setError(err.message);
        return;
      }
    }
    try {
      await requestJson(editingId ? `/api/sermons/${editingId}` : "/api/sermons", {
        method: editingId ? "PATCH" : "POST",
        body: {
          title,
          synopsis,
          speaker,
          link_url: linkUrl,
          sermon_date: sermonDate || null,
          series_id: finalSeriesId || null,
          // Only set status/notify on a brand-new post -- editing an
          // existing sermon shouldn't silently flip a published sermon
          // back to draft (that's what the explicit Publish button is
          // for), and shouldn't re-trigger a notification choice either.
          ...(editingId ? {} : { status: asDraft ? "draft" : "published", notify }),
        },
      });
    } catch (err) {
      setError(err.message); // the form keeps everything typed
      return;
    }
    toast.success(editingId ? "Sermon saved" : asDraft ? "Draft saved" : "Sermon posted");
    setEditingId(null);
    setTitle("");
    setSynopsis("");
    setSpeaker("");
    setLinkUrl("");
    setSermonDate("");
    setSeriesId("");
    setNewSeriesName("");
    setNotify(true);
    form.hide();
    reload();
  };

  const publish = async (id) => {
    const { ok } = await run(() => requestJson(`/api/sermons/${id}`, { method: "PATCH", body: { status: "published" } }), {
      success: "Sermon published",
    });
    if (ok) reload();
  };

  const remove = async (s) => {
    const yes = await confirm({
      title: `Delete "${s.title}"?`,
      message: "This sermon is removed for everyone.",
      confirmLabel: "Delete sermon",
    });
    if (!yes) return;
    const { ok } = await run(() => requestJson(`/api/sermons/${s.id}`, { method: "DELETE" }), { success: "Sermon deleted" });
    if (ok) reload();
  };

  // Editing reuses the same field state as posting -- editingId is the
  // only thing that switches submit() from POST /api/sermons to PATCH
  // /api/sermons/[id].
  const startEdit = (s, fromElement) => {
    setEditingId(s.id);
    setTitle(s.title);
    setSynopsis(s.synopsis);
    setSpeaker(s.speaker || "");
    setLinkUrl(s.link_url || "");
    setSermonDate(s.sermon_date || "");
    setSeriesId(s.series_id || "");
    setNewSeriesName("");
    form.show(fromElement);
  };

  const cancelForm = () => {
    setEditingId(null);
    setTitle("");
    setSynopsis("");
    setSpeaker("");
    setLinkUrl("");
    setSermonDate("");
    setSeriesId("");
    setNewSeriesName("");
    form.hide();
  };

  const filtered = useMemo(() => {
    if (!sermons) return [];
    if (!query.trim()) return sermons;
    const q = query.toLowerCase();
    return sermons.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.synopsis.toLowerCase().includes(q) ||
        (s.speaker && s.speaker.toLowerCase().includes(q))
    );
  }, [sermons, query]);

  return (
    <div className="px-5 pt-4 pb-6">
      <div ref={scrollAnchor} />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-serif text-2xl text-ink">{viewMode === "drafts" ? "Sermon Drafts" : "Sermons"}</h2>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode(viewMode === "drafts" ? "published" : "drafts")}
              className="sp-btn-secondary text-sm py-1.5 px-3"
            >
              {viewMode === "drafts" ? "Back to Sermons" : "Drafts"}
            </button>
            <button onClick={() => setSeriesSheetOpen(true)} className="sp-btn-secondary text-sm py-1.5 px-3">
              Manage series
            </button>
            <button ref={form.triggerRef} onClick={() => (showForm ? cancelForm() : form.show())} className="sp-btn-pill">
              {showForm ? "Cancel" : "+ Add"}
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <form ref={form.formRef} onSubmit={submit} className="sp-card mb-4" aria-labelledby="sermon-form-heading">
          <h3 id="sermon-form-heading" className="font-serif text-base text-ink mt-0 mb-3">
            {editingId ? "Edit sermon" : "New sermon"}
          </h3>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sermon title"
            required
            className="sp-input mb-2"
          />
          <div className="flex gap-2 mb-2">
            <input
              type="date"
              value={sermonDate}
              onChange={(e) => setSermonDate(e.target.value)}
              className="sp-input flex-1"
            />
            <input
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              placeholder="Speaker (optional)"
              className="sp-input flex-1"
            />
          </div>
          <textarea
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            placeholder="A short synopsis of the message"
            required
            rows={4}
            className="sp-textarea mb-2"
          />
          <div className="flex gap-2 mb-2">
            <select
              value={seriesId}
              onChange={(e) => {
                setSeriesId(e.target.value);
                setNewSeriesName("");
              }}
              className="sp-input flex-1"
            >
              <option value="">No series</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {!seriesId && (
            <input
              value={newSeriesName}
              onChange={(e) => setNewSeriesName(e.target.value)}
              placeholder="Or start a new series (optional)"
              className="sp-input mb-2"
            />
          )}
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Link to the video (Facebook, YouTube, etc.) — optional"
            className="sp-input mb-2"
          />
          {!editingId && (
            <label className="flex items-center gap-2 mb-2 text-sm text-inksoft">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              Notify everyone
            </label>
          )}
          <div className="flex gap-2 justify-end">
            {!editingId && (
              <button type="button" onClick={(e) => submit(e, true)} className="sp-btn-secondary sp-btn-compact">
                Save as Draft
              </button>
            )}
            <button type="submit" className="sp-btn-primary sp-btn-compact">{editingId ? "Save Changes" : "Post"}</button>
          </div>
          {error && <p className="text-sm mt-2 text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}

      {sermons !== null && sermons.length > 0 && (
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sermons or speakers..."
            className="sp-input pl-9"
          />
        </div>
      )}
      {series.length > 0 && (
        <>
          <select
            value={filterSeriesId}
            onChange={(e) => setFilterSeriesId(e.target.value)}
            className="sp-input mb-2"
          >
            <option value="">All series</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </>
      )}

      {sermons === null && loadFailed && <EmptyState kind="error" text="Couldn't load sermons." onRetry={load} />}
      {sermons === null && !loadFailed && <SkeletonList count={3} />}
      {sermons?.length === 0 && <EmptyState icon={Mic} text="No sermons posted yet." />}
      {sermons?.length > 0 && filtered.length === 0 && (
        <EmptyState icon={Search} text="No sermons match that search." />
      )}
      <div className="space-y-2">
        {filtered.map((s) => (
          <div key={s.id} className="sp-card">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {s.status === "draft" && (
                <span className="text-[0.625rem] uppercase tracking-wide bg-inkfaint/15 text-inkfaint rounded-full px-2 py-0.5 font-semibold">
                  Draft
                </span>
              )}
              {s.sermon_series?.name && (
                <span className="text-[0.625rem] uppercase tracking-wide bg-accent/10 text-accent rounded-full px-2 py-0.5 font-semibold">
                  {s.sermon_series.name}{s.series_order ? ` · Part ${s.series_order}` : ""}
                </span>
              )}
              <h3 className="font-medium text-ink">{s.title}</h3>
            </div>
            {(s.sermon_date || s.speaker) && (
              <p className="text-xs text-inkfaint mb-2">
                {s.sermon_date && fmtDate(s.sermon_date)}
                {s.sermon_date && s.speaker && " · "}
                {s.speaker}
              </p>
            )}
            <p className="text-sm text-inksoft whitespace-pre-wrap mb-2">{s.synopsis}</p>
            {s.link_url && (
              <a
                href={s.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs bg-accent/8 text-accent rounded-full px-3 py-1.5 mb-2"
              >
                Watch <ExternalLink size={11} />
              </a>
            )}
            <p className="text-xs text-inkfaint">
              {s.users?.display_name && `Posted by ${s.users.display_name}`}
            </p>
            {isAdmin && (
              <div className="flex gap-3 mt-2">
                <button onClick={(e) => startEdit(s, e.currentTarget)} data-return-focus={`sermon-edit-${s.id}`} className="text-xs text-accent underline flex items-center gap-1">
                  <Pencil size={11} /> Edit
                </button>
                {s.status === "draft" && (
                  <button onClick={() => publish(s.id)} className="text-xs text-sage underline font-semibold">
                    Publish
                  </button>
                )}
                <button onClick={() => remove(s)} className="text-xs text-inkfaint underline">
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {seriesSheetOpen && (
        <SermonSeriesSheet
          series={series}
          onClose={() => setSeriesSheetOpen(false)}
          onChanged={(deletedId) => {
            if (deletedId && filterSeriesId === deletedId) setFilterSeriesId("");
            reload();
          }}
        />
      )}
    </div>
  );
}
