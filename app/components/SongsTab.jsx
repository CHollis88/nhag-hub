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
    <div style={{ padding: 16 }}>
      <h2>Song Library</h2>

      {canManage && (
        <>
          <button onClick={() => setShowForm(!showForm)} style={{ marginBottom: 16 }}>
            {showForm ? "Cancel" : "+ Add a song"}
          </button>

          {showForm && (
            <form onSubmit={submit} style={{ marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8 }}>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Song title"
                required
                style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
              />
              <input
                value={form.composer}
                onChange={(e) => setForm({ ...form, composer: e.target.value })}
                placeholder="Composer (optional)"
                style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
              />
              <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                Add lyrics/chords/part links after creating the song, by editing it.
              </p>
              <button type="submit">Save song</button>
            </form>
          )}
        </>
      )}

      {songs === null && <p>Loading…</p>}
      {songs?.length === 0 && <p style={{ color: "#666" }}>No songs in the library yet.</p>}
      {songs?.map((s) => (
        <div key={s.id} style={{ background: "#fff", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <h3 style={{ margin: "0 0 4px" }}>{s.title}</h3>
          {s.composer && <p style={{ margin: "0 0 8px", color: "#666" }}>{s.composer}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {LINK_FIELDS.filter((f) => s[f.key]).map((f) => (
              <a key={f.key} href={s[f.key]} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                {f.label}
              </a>
            ))}
          </div>
          {canManage && (
            <button onClick={() => remove(s.id)} style={{ marginTop: 8, fontSize: 12 }}>
              Delete
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
