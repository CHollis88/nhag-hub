"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { SkeletonList } from "./Skeleton";
import SetlistForm from "./SetlistForm";
import MediaViewerModal from "./MediaViewerModal";
import { SONG_MEDIA_FIELDS } from "@/lib/songMedia";

function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SetlistsTab({ groupId, canManage, baseUrl, songsUrl }) {
  const [setlists, setSetlists] = useState(null);
  const [songs, setSongs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  // The full linked song object + which field to open on first render --
  // MediaViewerModal is the exact same full-screen viewer Songs uses,
  // so opening it here (as an overlay on top of this screen) and
  // closing it naturally lands right back on the setlist, with no
  // separate navigation/back-button plumbing needed.
  const [viewer, setViewer] = useState(null);

  // Same reuse pattern as SongsTab: defaults to the group's own
  // setlists URL so Choir's existing Setlists tab is unaffected;
  // Programs passes its own program-scoped URLs (see ProgramsTab.jsx).
  const url = baseUrl || `/api/groups/${groupId}/setlists`;
  const songLibraryUrl = songsUrl || `/api/groups/${groupId}/songs`;

  const load = async () => {
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) setSetlists(data.setlists);
  };

  useEffect(() => {
    load();
    fetch(songLibraryUrl)
      .then((r) => r.json())
      .then((d) => setSongs(d.songs || []));
  }, [url, songLibraryUrl]);

  // The form hands back the whole intended song list (with notes, in
  // order) in one go, matching the real Choir app's UX -- reorder/add/
  // remove/edit-note all happen locally in the form, then get saved as
  // one action. This app's API is still per-song rather than one bulk
  // endpoint, so a save just replays that intent as a short sequence of
  // calls against the existing add/remove endpoints -- same end result,
  // no new API surface needed.
  const create = async ({ service_date, service, songs: entries, notify }) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_date, service, notify }),
    });
    const data = await res.json();
    if (!res.ok) return;
    for (const entry of entries) {
      await fetch(`${url}/${data.setlist.id}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song_id: entry.song_id, note: entry.note }),
      });
    }
    setShowForm(false);
    load();
  };

  const saveEdit = async ({ service_date, service, songs: entries }) => {
    await fetch(`${url}/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_date, service }),
    });
    // Replace the whole song list: remove every existing entry, then
    // re-add the form's current list fresh, in order.
    for (const existingEntry of editing.songs) {
      await fetch(`${url}/${editing.id}/songs/${existingEntry.id}`, {
        method: "DELETE",
      });
    }
    for (const entry of entries) {
      await fetch(`${url}/${editing.id}/songs`, {
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
    await fetch(`${url}/${id}`, { method: "DELETE" });
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
              <ol className="space-y-2">
                {s.songs.map((song, i) => {
                  const linkedSong = song.group_songs || song.program_songs;
                  const available = linkedSong
                    ? SONG_MEDIA_FIELDS.filter(([key]) => linkedSong[key])
                    : [];
                  return (
                    <li key={song.id} className="text-sm">
                      <div className="flex items-baseline gap-2">
                        <span className="text-inkfaint w-4 flex-shrink-0">{i + 1}.</span>
                        <span className="text-ink flex-1">{linkedSong?.title}</span>
                        {song.note && <span className="text-inkfaint text-xs">{song.note}</span>}
                      </div>
                      {available.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1 ml-6">
                          {available.map(([key, label, Icon]) => (
                            <button
                              key={key}
                              onClick={() => setViewer({ song: linkedSong, field: key })}
                              className="inline-flex items-center gap-1 text-[0.6875rem] bg-accent/8 text-accent rounded-full px-2 py-1"
                            >
                              <Icon size={10} /> {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
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

      {viewer && (
        <MediaViewerModal song={viewer.song} initialField={viewer.field} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
