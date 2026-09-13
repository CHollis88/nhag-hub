"use client";

import { useEffect, useState, useCallback } from "react";

function SetlistCard({ groupId, setlist, songLibrary, canManage, onChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [addingSongId, setAddingSongId] = useState("");

  const addSong = async () => {
    if (!addingSongId) return;
    await fetch(`/api/groups/${groupId}/setlists/${setlist.id}/songs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ song_id: addingSongId }),
    });
    setAddingSongId("");
    onChanged();
  };

  const removeSong = async (setlistSongId) => {
    await fetch(`/api/groups/${groupId}/setlists/${setlist.id}/songs/${setlistSongId}`, { method: "DELETE" });
    onChanged();
  };

  const move = async (index, direction) => {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= setlist.songs.length) return;
    const a = setlist.songs[index];
    const b = setlist.songs[otherIndex];
    await Promise.all([
      fetch(`/api/groups/${groupId}/setlists/${setlist.id}/songs/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: b.position }),
      }),
      fetch(`/api/groups/${groupId}/setlists/${setlist.id}/songs/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: a.position }),
      }),
    ]);
    onChanged();
  };

  const deleteSetlist = async () => {
    if (!confirm("Delete this whole setlist?")) return;
    await fetch(`/api/groups/${groupId}/setlists/${setlist.id}`, { method: "DELETE" });
    onChanged();
  };

  const availableSongs = songLibrary.filter((s) => !setlist.songs.some((ss) => ss.group_songs?.id === s.id));

  return (
    <div className="sp-card">
      <div className="flex justify-between items-center">
        <div>
          <strong className="text-ink">
            {new Date(setlist.service_date + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </strong>{" "}
          <span className="text-inkfaint">· {setlist.service}</span>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-accent underline">
          {expanded ? "Hide" : "View"}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-linesoft">
          {setlist.songs.length === 0 && <p className="text-sm text-inkfaint">No songs added yet.</p>}
          {setlist.songs.map((ss, i) => (
            <div key={ss.id} className="flex justify-between items-center py-1.5">
              <span className="text-sm text-ink">
                {i + 1}. {ss.group_songs?.title}
                {ss.note && <span className="text-inkfaint"> — {ss.note}</span>}
              </span>
              {canManage && (
                <div className="flex gap-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-xs text-inkfaint disabled:opacity-30">↑</button>
                  <button onClick={() => move(i, 1)} disabled={i === setlist.songs.length - 1} className="text-xs text-inkfaint disabled:opacity-30">↓</button>
                  <button onClick={() => removeSong(ss.id)} className="text-xs text-inkfaint underline">Remove</button>
                </div>
              )}
            </div>
          ))}

          {canManage && (
            <div className="flex gap-2 mt-3">
              <select value={addingSongId} onChange={(e) => setAddingSongId(e.target.value)} className="sp-input flex-1">
                <option value="">Add a song from the library…</option>
                {availableSongs.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              <button onClick={addSong} className="sp-btn-secondary px-4">Add</button>
            </div>
          )}

          {canManage && (
            <button onClick={deleteSetlist} className="text-xs text-inkfaint mt-3 underline">
              Delete this setlist
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SetlistsTab({ groupId, canManage }) {
  const [setlists, setSetlists] = useState(null);
  const [songLibrary, setSongLibrary] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState("");
  const [service, setService] = useState("AM");

  const load = useCallback(async () => {
    const [setlistsRes, songsRes] = await Promise.all([
      fetch(`/api/groups/${groupId}/setlists`),
      fetch(`/api/groups/${groupId}/songs`),
    ]);
    const setlistsData = await setlistsRes.json();
    const songsData = await songsRes.json();
    if (setlistsRes.ok) setSetlists(setlistsData.setlists);
    if (songsRes.ok) setSongLibrary(songsData.songs);
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/groups/${groupId}/setlists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_date: date, service }),
    });
    if (res.ok) {
      setDate("");
      setShowForm(false);
      load();
    }
  };

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-4">Setlists</h2>

      {canManage && (
        <>
          <button onClick={() => setShowForm(!showForm)} className="sp-btn-secondary mb-4">
            {showForm ? "Cancel" : "+ New setlist"}
          </button>

          {showForm && (
            <form onSubmit={submit} className="sp-card flex gap-2 mb-4">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="sp-input flex-1" />
              <select value={service} onChange={(e) => setService(e.target.value)} className="sp-input">
                <option value="AM">AM</option>
                <option value="PM">PM</option>
                <option value="CP">CP</option>
              </select>
              <button type="submit" className="sp-btn-primary px-4">Create</button>
            </form>
          )}
        </>
      )}

      {setlists === null && <p className="text-sm text-inkfaint">Loading…</p>}
      {setlists?.length === 0 && <p className="text-sm text-inkfaint">No setlists yet.</p>}
      <div className="space-y-2">
        {setlists?.map((s) => (
          <SetlistCard
            key={s.id}
            groupId={groupId}
            setlist={s}
            songLibrary={songLibrary}
            canManage={canManage}
            onChanged={load}
          />
        ))}
      </div>
    </div>
  );
}
