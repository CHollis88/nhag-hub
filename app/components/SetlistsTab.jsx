"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { SkeletonList } from "./Skeleton";
import SetlistForm from "./SetlistForm";

function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SetlistsTab({ groupId, canManage }) {
  const [setlists, setSetlists] = useState(null);
  const [songs, setSongs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const res = await fetch(`/api/groups/${groupId}/setlists`);
    const data = await res.json();
    if (res.ok) setSetlists(data.setlists);
  };

  useEffect(() => {
    load();
    fetch(`/api/groups/${groupId}/songs`)
      .then((r) => r.json())
      .then((d) => setSongs(d.songs || []));
  }, [groupId]);

  // The form hands back the whole intended song list (with notes, in
  // order) in one go, matching the real Choir app's UX -- reorder/add/
  // remove/edit-note all happen locally in the form, then get saved as
  // one action. This app's API is still per-song rather than one bulk
  // endpoint, so a save just replays that intent as a short sequence of
  // calls against the existing add/remove endpoints -- same end result,
  // no new API surface needed.
  const create = async ({ service_date, service, songs: entries }) => {
    const res = await fetch(`/api/groups/${groupId}/setlists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_date, service }),
    });
    const data = await res.json();
    if (!res.ok) return;
    for (const entry of entries) {
      await fetch(`/api/groups/${groupId}/setlists/${data.setlist.id}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song_id: entry.song_id, note: entry.note }),
      });
    }
    setShowForm(false);
    load();
  };

  const saveEdit = async ({ service_date, service, songs: entries }) => {
    await fetch(`/api/groups/${groupId}/setlists/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_date, service }),
    });
    // Replace the whole song list: remove every existing entry, then
    // re-add the form's current list fresh, in order.
    for (const existingEntry of editing.songs) {
      await fetch(`/api/groups/${groupId}/setlists/${editing.id}/songs/${existingEntry.id}`, {
        method: "DELETE",
      });
    }
    for (const entry of entries) {
      await fetch(`/api/groups/${groupId}/setlists/${editing.id}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song_id: entry.song_id, note: entry.note }),
      });
    }
    setEditing(null);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this whole setlist?")) return;
    await fetch(`/api/groups/${groupId}/setlists/${id}`, { method: "DELETE" });
    load();
  };

  if (setlists === null) return <div className="px-5 pt-4"><SkeletonList count={3} /></div>;

  return (
    <div className="px-5 pt-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl text-ink">Setlists</h2>
        {canManage && (
          <button onClick={() => setShowForm(true)} className="sp-btn-pill">
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      {showForm && (
        <SetlistForm allSongs={songs} onCancel={() => setShowForm(false)} onSave={create} />
      )}
      {editing && (
        <SetlistForm
          initial={editing}
          allSongs={songs}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      {setlists.length === 0 && !showForm && (
        <p className="text-sm text-inkfaint text-center py-6">No setlists posted yet.</p>
      )}

      <div className="space-y-3">
        {setlists.map((s) => (
          <div key={s.id} className="sp-card relative">
            <div className="flex items-center justify-between mb-2 pr-14">
              <p className="font-serif text-lg text-ink">{fmtDate(s.service_date)}</p>
              <span className="text-[0.625rem] uppercase tracking-wide bg-navy/10 text-navy dark:bg-blue-400/15 dark:text-blue-300 rounded-full px-2 py-0.5 font-semibold">
                {s.service}
              </span>
            </div>
            {s.songs.length === 0 ? (
              <p className="text-sm text-inkfaint">No songs added yet.</p>
            ) : (
              <ol className="space-y-1">
                {s.songs.map((song, i) => (
                  <li key={song.id} className="flex items-baseline gap-2 text-sm">
                    <span className="text-inkfaint w-4 flex-shrink-0">{i + 1}.</span>
                    <span className="text-ink flex-1">{song.group_songs?.title}</span>
                    {song.note && <span className="text-inkfaint text-xs">{song.note}</span>}
                  </li>
                ))}
              </ol>
            )}
            {canManage && (
              <div className="absolute top-4 right-4 flex items-center gap-3">
                <button onClick={() => setEditing(s)} className="text-inkfaint" aria-label="Edit">
                  <Pencil size={14} />
                </button>
                <button onClick={() => remove(s.id)} className="text-inkfaint" aria-label="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
