"use client";

import { useEffect, useState, useCallback } from "react";

const LINK_FIELDS = [
  { key: "lyrics_url", label: "Lyrics" },
  { key: "chords_url", label: "Chords" },
  { key: "sheet_music_url", label: "Sheet Music" },
  { key: "soprano_url", label: "Soprano" },
  { key: "alto_url", label: "Alto" },
  { key: "tenor_url", label: "Tenor" },
  { key: "bass_url", label: "Bass" },
  { key: "full_mix_url", label: "Full Mix" },
];

export default function SongsTab({ groupId, canManage }) {
  const [songs, setSongs] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", composer: "" });

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/songs`);
    const data = await res.json();
    if (res.ok) setSongs(data.songs);
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/groups/${groupId}/songs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ title: "", composer: "" });
      setShowForm(false);
      load();
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this song? It will also be removed from any setlists it's in.")) return;
    await fetch(`/api/groups/${groupId}/songs/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-4">Song Library</h2>

      {canManage && (
        <>
          <button onClick={() => setShowForm(!showForm)} className="sp-btn-secondary mb-4">
            {showForm ? "Cancel" : "+ Add a song"}
          </button>

          {showForm && (
            <form onSubmit={submit} className="sp-card mb-4">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Song title"
                required
                className="sp-input mb-2"
              />
              <input
                value={form.composer}
                onChange={(e) => setForm({ ...form, composer: e.target.value })}
                placeholder="Composer (optional)"
                className="sp-input mb-2"
              />
              <p className="text-xs text-inkfaint mb-2">
                Add lyrics/chords/part links after creating the song, by editing it.
              </p>
              <button type="submit" className="sp-btn-primary">Save song</button>
            </form>
          )}
        </>
      )}

      {songs === null && <p className="text-sm text-inkfaint">Loading…</p>}
      {songs?.length === 0 && <p className="text-sm text-inkfaint">No songs in the library yet.</p>}
      <div className="space-y-2">
        {songs?.map((s) => (
          <div key={s.id} className="sp-card">
            <h3 className="font-medium text-ink mb-1">{s.title}</h3>
            {s.composer && <p className="text-sm text-inksoft mb-2">{s.composer}</p>}
            <div className="flex flex-wrap gap-2">
              {LINK_FIELDS.filter((f) => s[f.key]).map((f) => (
                <a key={f.key} href={s[f.key]} target="_blank" rel="noreferrer" className="text-xs text-accent underline">
                  {f.label}
                </a>
              ))}
            </div>
            {canManage && (
              <button onClick={() => remove(s.id)} className="text-xs text-inkfaint mt-2 underline">
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
