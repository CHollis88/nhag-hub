"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ExternalLink, Search, Mic } from "lucide-react";
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
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [sermonDate, setSermonDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/sermons");
    const data = await res.json();
    if (res.ok) setSermons(data.sermons);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/sermons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, synopsis, speaker, link_url: linkUrl, sermon_date: sermonDate || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setTitle("");
    setSynopsis("");
    setSpeaker("");
    setLinkUrl("");
    setSermonDate("");
    setShowForm(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this sermon?")) return;
    await fetch(`/api/sermons/${id}`, { method: "DELETE" });
    load();
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-2xl text-ink">Sermons</h2>
        {isAdmin && (
          <button onClick={() => setShowForm((s) => !s)} className="sp-btn-pill">
            {showForm ? "Cancel" : "+ Post"}
          </button>
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
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Link to the video (Facebook, YouTube, etc.) — optional"
            className="sp-input mb-2"
          />
          <button type="submit" className="sp-btn-primary">Post</button>
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

      {sermons === null && <SkeletonList count={3} />}
      {sermons?.length === 0 && <EmptyState icon={Mic} text="No sermons posted yet." />}
      {sermons?.length > 0 && filtered.length === 0 && (
        <EmptyState icon={Search} text="No sermons match that search." />
      )}
      <div className="space-y-2">
        {filtered.map((s) => (
          <div key={s.id} className="sp-card">
            <h3 className="font-medium text-ink mb-1">{s.title}</h3>
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
              <button onClick={() => remove(s.id)} className="text-xs text-inkfaint mt-2 underline block">
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
