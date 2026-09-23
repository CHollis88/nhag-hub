"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ExternalLink, Search, Mic, Pencil, Trash2 } from "lucide-react";
import EmptyState from "./EmptyState";
import { SkeletonList } from "./Skeleton";

function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function SermonsTab({ isAdmin }) {
  const [sermons, setSermons] = useState(null);
  const [series, setSeries] = useState([]);
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [sermonDate, setSermonDate] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [newSeriesName, setNewSeriesName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filterSeriesId, setFilterSeriesId] = useState("");
  const [viewMode, setViewMode] = useState("published"); // admin-only "Drafts" toggle
  const [notify, setNotify] = useState(true);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterSeriesId) params.set("series_id", filterSeriesId);
    if (viewMode === "drafts") params.set("drafts", "1");
    const qs = params.toString();
    const res = await fetch(`/api/sermons${qs ? `?${qs}` : ""}`);
    const data = await res.json();
    if (res.ok) setSermons(data.sermons);
  }, [filterSeriesId, viewMode]);

  const loadSeries = useCallback(async () => {
    const res = await fetch("/api/sermon-series");
    const data = await res.json();
    if (res.ok) setSeries(data.series);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  const submit = async (e, asDraft = false) => {
    e.preventDefault();
    setError("");
    let finalSeriesId = seriesId;
    // Creating a new series inline is the only path -- no separate
    // "manage series" screen, since a series is really just a label
    // applied while posting a sermon.
    if (!finalSeriesId && newSeriesName.trim()) {
      const seriesRes = await fetch("/api/sermon-series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSeriesName.trim() }),
      });
      const seriesData = await seriesRes.json();
      if (seriesRes.ok) finalSeriesId = seriesData.series.id;
    }
    const res = await fetch(editingId ? `/api/sermons/${editingId}` : "/api/sermons", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setEditingId(null);
    setTitle("");
    setSynopsis("");
    setSpeaker("");
    setLinkUrl("");
    setSermonDate("");
    setSeriesId("");
    setNewSeriesName("");
    setNotify(true);
    setShowForm(false);
    load();
    loadSeries();
  };

  const publish = async (id) => {
    await fetch(`/api/sermons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this sermon?")) return;
    await fetch(`/api/sermons/${id}`, { method: "DELETE" });
    load();
  };

  // Editing reuses the same field state as posting -- editingId is the
  // only thing that switches submit() from POST /api/sermons to PATCH
  // /api/sermons/[id].
  const [editingId, setEditingId] = useState(null);

  const startEdit = (s) => {
    setEditingId(s.id);
    setTitle(s.title);
    setSynopsis(s.synopsis);
    setSpeaker(s.speaker || "");
    setLinkUrl(s.link_url || "");
    setSermonDate(s.sermon_date || "");
    setSeriesId(s.series_id || "");
    setNewSeriesName("");
    setShowForm(true);
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
    setShowForm(false);
  };

  const deleteSeries = async (id) => {
    if (!confirm("Delete this series? Sermons in it stay, just ungrouped.")) return;
    await fetch(`/api/sermon-series/${id}`, { method: "DELETE" });
    if (filterSeriesId === id) setFilterSeriesId("");
    load();
    loadSeries();
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
            <button onClick={() => (showForm ? cancelForm() : setShowForm(true))} className="sp-btn-pill">
              {showForm ? "Cancel" : "+ Post"}
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="sp-card mb-4">
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
          <div className="flex gap-2">
            {!editingId && (
              <button type="button" onClick={(e) => submit(e, true)} className="sp-btn-secondary flex-1">
                Save as Draft
              </button>
            )}
            <button type="submit" className="sp-btn-primary flex-1">{editingId ? "Save Changes" : "Post"}</button>
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
          {isAdmin && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {series.map((s) => (
                <button
                  key={s.id}
                  onClick={() => deleteSeries(s.id)}
                  className="text-[0.6875rem] text-inkfaint underline flex items-center gap-1"
                >
                  <Trash2 size={10} /> Delete &quot;{s.name}&quot;
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {sermons === null && <SkeletonList count={3} />}
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
                <button onClick={() => startEdit(s)} className="text-xs text-accent underline flex items-center gap-1">
                  <Pencil size={11} /> Edit
                </button>
                {s.status === "draft" && (
                  <button onClick={() => publish(s.id)} className="text-xs text-sage underline font-semibold">
                    Publish
                  </button>
                )}
                <button onClick={() => remove(s.id)} className="text-xs text-inkfaint underline">
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
