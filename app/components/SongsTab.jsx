"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Trash2, Pencil } from "lucide-react";
import { SkeletonRowList } from "./Skeleton";
import SongForm from "./SongForm";
import MediaViewerModal from "./MediaViewerModal";
import { SONG_MEDIA_FIELDS } from "@/lib/songMedia";

function SongRow({ baseUrl, song, canManage, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [viewerField, setViewerField] = useState(null);

  const availableLinks = SONG_MEDIA_FIELDS.filter(([key]) => song[key]);

  const saveEdit = async (fields) => {
    await fetch(`${baseUrl}/${song.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    setEditing(false);
    onUpdated();
  };

  const remove = async () => {
    if (!confirm("Delete this song? It will also be removed from any setlists it's in.")) return;
    await fetch(`${baseUrl}/${song.id}`, { method: "DELETE" });
    onUpdated();
  };

  if (editing) {
    return <SongForm initial={song} onCancel={() => setEditing(false)} onSave={saveEdit} />;
  }

  return (
    <div className="border border-line rounded-xl overflow-hidden bg-card">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div className="min-w-0">
          <p className="font-serif text-base text-ink truncate">{song.title}</p>
          {song.composer && <p className="text-xs text-inkfaint truncate">{song.composer}</p>}
        </div>
      </button>

      {open && (
        <div className="border-t border-linesoft px-4 py-3">
          {availableLinks.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-2">
              {availableLinks.map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setViewerField(key)}
                  className="inline-flex items-center gap-1.5 text-xs bg-accent/8 text-accent rounded-full px-3 py-1.5"
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-inkfaint mb-2">Nothing linked yet for this song.</p>
          )}

          {song.notes && <p className="text-sm text-inksoft mb-2">{song.notes}</p>}

          {canManage && (
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditing(true)} className="text-xs text-inkfaint flex items-center gap-1">
                <Pencil size={12} /> Edit
              </button>
              <button onClick={remove} className="text-xs text-inkfaint flex items-center gap-1">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      )}

      {viewerField && (
        <MediaViewerModal song={song} initialField={viewerField} onClose={() => setViewerField(null)} />
      )}
    </div>
  );
}

export default function SongsTab({ groupId, canManage, baseUrl }) {
  const [songs, setSongs] = useState(null);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Defaults to the group's own song library URL so every existing
  // caller (Choir's Songs tab) behaves exactly as before -- Programs
  // passes its own program-scoped URL instead (see ProgramsTab.jsx),
  // reusing this same well-tested list/search/edit UI rather than
  // forking it, since a program's song library is a separate table but
  // an identical shape and behavior.
  const url = baseUrl || `/api/groups/${groupId}/songs`;

  const load = async () => {
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) setSongs(data.songs);
  };

  useEffect(() => {
    load();
  }, [url]);

  const filtered = useMemo(() => {
    if (!songs) return [];
    if (!query.trim()) return songs;
    const q = query.toLowerCase();
    return songs.filter(
      (s) => s.title.toLowerCase().includes(q) || (s.composer && s.composer.toLowerCase().includes(q))
    );
  }, [songs, query]);

  const create = async (fields) => {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    setShowForm(false);
    load();
  };

  if (songs === null) return <div className="px-5 pt-4"><SkeletonRowList count={5} /></div>;

  return (
    <div className="px-5 pt-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl text-ink">Songs</h2>
        {canManage && (
          <button onClick={() => setShowForm((s) => !s)} className="sp-btn-pill">
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or composer..."
          className="sp-input pl-9"
        />
      </div>

      {showForm && <SongForm onCancel={() => setShowForm(false)} onSave={create} />}

      {filtered.length === 0 && !showForm && (
        <p className="text-sm text-inkfaint text-center py-6">
          {query ? "No songs match that search." : "No songs yet."}
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((song) => (
          <SongRow key={song.id} baseUrl={url} song={song} canManage={canManage} onUpdated={load} />
        ))}
      </div>

      {!query && songs.length > 0 && (
        <p className="text-[0.6875rem] text-inkfaint text-center mt-4">{songs.length} songs in the library</p>
      )}
    </div>
  );
}
