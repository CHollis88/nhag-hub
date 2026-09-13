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

  // Simple up/down swap rather than drag-and-drop -- swaps this entry's
  // position with its neighbor's.
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
    <div style={{ background: "#fff", borderRadius: 8, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong>
            {new Date(setlist.service_date + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </strong>{" "}
          <span style={{ color: "#666" }}>· {setlist.service}</span>
        </div>
        <button onClick={() => setExpanded(!expanded)} style={{ fontSize: 12 }}>
          {expanded ? "Hide" : "View"}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
          {setlist.songs.length === 0 && <p style={{ color: "#666", fontSize: 13 }}>No songs added yet.</p>}
          {setlist.songs.map((ss, i) => (
            <div
              key={ss.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}
            >
              <span>
                {i + 1}. {ss.group_songs?.title}
                {ss.note && <span style={{ color: "#999" }}> — {ss.note}</span>}
              </span>
              {canManage && (
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => move(i, -1)} disabled={i === 0} style={{ fontSize: 11 }}>↑</button>
                  <button onClick={() => move(i, 1)} disabled={i === setlist.songs.length - 1} style={{ fontSize: 11 }}>↓</button>
                  <button onClick={() => removeSong(ss.id)} style={{ fontSize: 11 }}>Remove</button>
                </div>
              )}
            </div>
          ))}

          {canManage && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <select value={addingSongId} onChange={(e) => setAddingSongId(e.target.value)} style={{ flex: 1, padding: 6 }}>
                <option value="">Add a song from the library…</option>
                {availableSongs.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              <button onClick={addSong}>Add</button>
            </div>
          )}

          {canManage && (
            <button onClick={deleteSetlist} style={{ marginTop: 12, fontSize: 12 }}>
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
    <div style={{ padding: 16 }}>
      <h2>Setlists</h2>

      {canManage && (
        <>
          <button onClick={() => setShowForm(!showForm)} style={{ marginBottom: 16 }}>
            {showForm ? "Cancel" : "+ New setlist"}
          </button>

          {showForm && (
            <form onSubmit={submit} style={{ display: "flex", gap: 8, marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8 }}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={{ flex: 1, padding: 8 }} />
              <select value={service} onChange={(e) => setService(e.target.value)} style={{ padding: 8 }}>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
                <option value="CP">CP</option>
              </select>
              <button type="submit">Create</button>
            </form>
          )}
        </>
      )}

      {setlists === null && <p>Loading…</p>}
      {setlists?.length === 0 && <p style={{ color: "#666" }}>No setlists yet.</p>}
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
  );
}
