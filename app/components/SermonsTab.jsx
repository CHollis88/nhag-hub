"use client";

import { useEffect, useState, useCallback } from "react";
import { ExternalLink } from "lucide-react";

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

      {sermons === null && <p className="text-sm text-inkfaint">Loading…</p>}
      {sermons?.length === 0 && <p className="text-sm text-inkfaint">No sermons posted yet.</p>}
      <div className="space-y-2">
        {sermons?.map((s) => (
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
