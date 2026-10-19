"use client";

import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, X, Plus, Check, Pencil, Trash2, ListMusic } from "lucide-react";
import { SkeletonList } from "./Skeleton";
import EmptyState from "./EmptyState";
import QueuePlayer from "./QueuePlayer";
import { PartChips } from "./ListenByPartModal";
import { useAction } from "./useAction";
import { useConfirm } from "./ConfirmDialog";
import { requestJson } from "@/lib/request";
import { useResource } from "@/lib/useResource";
import { STALE } from "@/lib/resourceCache";
import {
  listenParts,
  buildQueue,
  byTrackToggles,
  buildSongQueue,
  buildCustomQueue,
  songTrackOptions,
  entriesForPart,
  trackLabelFor,
} from "@/lib/listenQueue";

// v71_18 -- a program's Playlist tab. Three ways to listen to the program's songs:
//
//   By part   one part, song after song      (Soprano 1, Soprano 2, ...)
//   By song   every track of a song, then the next song's (Demo, Split, Soprano ...)
//   Custom    a playlist you build yourself: specific tracks of specific songs, in
//             your order. Private to you; saved per program.
//
// By part and By song play the whole program A-Z, or the running order of one of
// its setlists (pick it in "Play from"). All three share QueuePlayer.

const MODES = [
  { id: "part", label: "By part", hint: "One part, song after song. Like Alto 1, Alto 2, Alto 3." },
  { id: "song", label: "By song", hint: "Every track of a song, then the next song's. Like Song 1 Demo, Split Track, Soprano." },
  { id: "custom", label: "Custom", hint: "A playlist you build yourself, in your own order. Only you can see it." },
];

function songsOfSetlist(setlist) {
  return (setlist?.songs || []).map((x) => x.program_songs).filter(Boolean);
}

function fmtSetlistName(s) {
  const d = new Date(`${s.service_date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${d} · ${s.service}`;
}

export default function ProgramPlaylistTab({ groupId, programId, programName }) {
  const base = `/api/groups/${groupId}/programs/${programId}`;
  const songsUrl = `${base}/songs`;
  const setlistsUrl = `${base}/setlists`;

  // Same cache entries the Songs and Setlist tabs use, so opening this after
  // them costs no request.
  const { data: songs, error: songsError, refresh: reloadSongs } = useResource(
    `group:${groupId}:${songsUrl}`,
    async () => (await requestJson(songsUrl)).songs,
    { staleMs: STALE.list }
  );
  const { data: setlists } = useResource(`group:${groupId}:${setlistsUrl}`, async () => (await requestJson(setlistsUrl)).setlists, {
    staleMs: STALE.list,
  });

  const [mode, setMode] = useState("part");
  const [sourceId, setSourceId] = useState("all");

  const sourceSongs = useMemo(() => {
    if (!songs) return [];
    if (sourceId === "all") return songs;
    const hit = (setlists || []).find((s) => s.id === sourceId);
    return hit ? songsOfSetlist(hit) : songs;
  }, [songs, setlists, sourceId]);
  const sourceName = sourceId === "all" || !(setlists || []).some((s) => s.id === sourceId)
    ? "All songs"
    : fmtSetlistName(setlists.find((s) => s.id === sourceId));

  if (songs === null && songsError) return <EmptyState kind="error" text="Couldn't load songs." onRetry={reloadSongs} />;
  if (songs === null) return <div className="px-5 pt-4"><SkeletonList count={3} /></div>;

  const anyTrack = listenParts(songs).length > 0;
  const hint = MODES.find((m) => m.id === mode)?.hint;
  const title = `${programName || "Program"} · ${mode === "custom" ? "My playlist" : sourceName}`;

  return (
    <div className="px-5 pt-4 pb-8">
      <h2 className="font-serif text-xl text-ink mb-3">Playlist</h2>

      {!anyTrack && mode !== "custom" ? (
        <EmptyState icon={ListMusic} text="None of this program's songs have a track linked yet. Add links in the Songs tab, then come back here to listen." />
      ) : null}

      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="How to listen">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
            className={`rounded-xl text-sm font-semibold min-h-[44px] px-2 ${
              mode === m.id ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-inkfaint mt-2 mb-3">{hint}</p>

      {mode !== "custom" && anyTrack && (
        <div className="mb-3">
          <label htmlFor="playlist-source" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">
            Play from
          </label>
          <select id="playlist-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="sp-input">
            <option value="all">All songs (A–Z)</option>
            {(setlists || []).map((s) => (
              <option key={s.id} value={s.id}>
                Setlist: {fmtSetlistName(s)} (running order)
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === "part" && anyTrack && <PartMode key={`part-${sourceId}`} songs={sourceSongs} title={title} />}
      {mode === "song" && anyTrack && <SongMode key={`song-${sourceId}`} songs={sourceSongs} title={title} />}
      {mode === "custom" && <CustomMode songs={songs} base={base} groupId={groupId} programName={programName} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function PartMode({ songs, title }) {
  const parts = useMemo(() => listenParts(songs), [songs]);
  const [partId, setPartId] = useState(() => (parts.find((p) => p.id === "split_track_url") || parts[0])?.id || null);
  const part = parts.find((p) => p.id === partId) || parts[0] || null;
  const { items, skipped } = useMemo(() => (part ? buildQueue(songs, part) : { items: [], skipped: [] }), [songs, part]);
  if (!part) return <p className="text-sm text-inkfaint">None of these songs have a track linked yet.</p>;
  return (
    <QueuePlayer
      embedded
      items={items}
      skipped={skipped}
      skippedPrefix={`Skipped, nothing to play for ${part.label}:`}
      title={title}
      controls={<PartChips parts={parts} partId={part.id} onPick={setPartId} />}
    />
  );
}

function SongMode({ songs, title }) {
  const toggles = useMemo(() => byTrackToggles(songs), [songs]);
  const [off, setOff] = useState(() => new Set()); // switched OFF, so new kinds default to on
  const enabled = useMemo(() => new Set(toggles.filter((t) => !off.has(t.id)).map((t) => t.id)), [toggles, off]);
  const { items, skipped } = useMemo(() => buildSongQueue(songs, enabled), [songs, enabled]);
  const flip = (id) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <QueuePlayer
      embedded
      showLabels
      items={items}
      skipped={skipped}
      skippedPrefix="Skipped, no tracks switched on:"
      title={title}
      controls={
        <div>
          <p className="text-xs text-inkfaint mt-0 mb-1.5">Tracks to include</p>
          <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Tracks to include">
            {toggles.map((t) => {
              const on = enabled.has(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => flip(t.id)}
                  aria-pressed={on}
                  className={`text-xs font-semibold rounded-full px-3 py-1.5 flex items-center gap-1 ${
                    on ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
                  }`}
                >
                  {on && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                  {t.label} <span className="font-normal opacity-80">· {t.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Custom: my playlists

function CustomMode({ songs, base, groupId, programName }) {
  const run = useAction();
  const confirm = useConfirm();
  const listUrl = `${base}/playlists`;
  const key = `group:${groupId}:${listUrl}`;
  const { data: playlists, error, refresh, setData } = useResource(key, async () => (await requestJson(listUrl)).playlists, {
    staleMs: STALE.list,
  });

  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  if (playlists === null && error) return <EmptyState kind="error" text="Couldn't load your playlists." onRetry={refresh} />;
  if (playlists === null) return <SkeletonList count={2} />;

  const selected = playlists.find((p) => p.id === selectedId) || (playlists.length === 1 && !creating ? playlists[0] : null);

  const create = async (e) => {
    e?.preventDefault();
    if (!newName.trim()) return;
    const { ok, data } = await run(() => requestJson(listUrl, { method: "POST", body: { name: newName.trim() } }), {
      success: "Playlist created",
    });
    if (!ok) return;
    setCreating(false);
    setNewName("");
    await refresh().catch(() => {});
    setSelectedId(data.playlist.id);
    setEditing(true); // a new playlist is empty, so go straight to adding tracks
  };

  const remove = async (pl) => {
    const yes = await confirm({
      title: `Delete "${pl.name}"?`,
      message: "This only removes the playlist. The songs and their tracks are not touched.",
      confirmLabel: "Delete playlist",
    });
    if (!yes) return;
    const { ok } = await run(() => requestJson(`${listUrl}/${pl.id}`, { method: "DELETE" }), { success: "Playlist deleted" });
    if (!ok) return;
    setSelectedId(null);
    setEditing(false);
    refresh().catch(() => {});
  };

  return (
    <div>
      <div className="flex gap-1.5 flex-wrap items-center mb-3">
        {playlists.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setSelectedId(p.id);
              setEditing(false);
              setCreating(false);
            }}
            aria-pressed={selected?.id === p.id}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 ${
              selected?.id === p.id ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
            }`}
          >
            {p.name} <span className="font-normal opacity-80">· {p.items.length}</span>
          </button>
        ))}
        <button
          onClick={() => setCreating((v) => !v)}
          className="sp-btn-pill"
        >
          {creating ? "Cancel" : (<><Plus size={14} aria-hidden="true" /> New playlist</>)}
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="sp-card mb-3 space-y-2">
          <label htmlFor="new-playlist-name" className="block text-xs uppercase tracking-wide text-inkfaint">
            Playlist name
          </label>
          <input
            id="new-playlist-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={60}
            placeholder="e.g. Alto learning, first half"
            autoFocus
            className="sp-input"
          />
          <div className="flex justify-end">
            <button type="submit" disabled={!newName.trim()} className="sp-btn-primary sp-btn-compact disabled:opacity-60">
              Create
            </button>
          </div>
        </form>
      )}

      {playlists.length === 0 && !creating && (
        <EmptyState
          icon={ListMusic}
          text="No playlists yet. Make one to pick exactly which tracks play, and in what order."
          action={{ label: "New playlist", onClick: () => setCreating(true) }}
        />
      )}

      {playlists.length > 1 && !selected && !creating && (
        <p className="text-sm text-inkfaint">Pick a playlist above.</p>
      )}

      {selected && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-serif text-lg text-ink m-0 min-w-0 truncate">{selected.name}</h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => setEditing((v) => !v)} className="sp-btn-pill">
                {editing ? "Done" : (<><Pencil size={13} aria-hidden="true" /> Edit</>)}
              </button>
              <button onClick={() => remove(selected)} className="text-inkfaint p-2" aria-label={`Delete ${selected.name}`}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {editing ? (
            <PlaylistEditor
              key={selected.id}
              songs={songs}
              playlist={selected}
              listUrl={listUrl}
              run={run}
              refresh={refresh}
              setData={setData}
            />
          ) : (
            <PlaylistPlayer songs={songs} playlist={selected} programName={programName} onEdit={() => setEditing(true)} />
          )}
        </div>
      )}
    </div>
  );
}

function PlaylistPlayer({ songs, playlist, programName, onEdit }) {
  const { items, skipped } = useMemo(() => buildCustomQueue(songs, playlist.items), [songs, playlist.items]);
  if (playlist.items.length === 0) {
    return (
      <EmptyState icon={ListMusic} text="This playlist is empty." action={{ label: "Add tracks", onClick: onEdit }} />
    );
  }
  return (
    <QueuePlayer
      embedded
      showLabels
      items={items}
      skipped={skipped}
      skippedPrefix="Skipped, no link to play:"
      title={`${programName || "Program"} · ${playlist.name}`}
    />
  );
}

// ---------------------------------------------------------------------------

function PlaylistEditor({ songs, playlist, listUrl, run, refresh, setData }) {
  const url = `${listUrl}/${playlist.id}`;
  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);
  const [name, setName] = useState(playlist.name);
  const [adding, setAdding] = useState(playlist.items.length === 0);
  const [picked, setPicked] = useState(() => new Set()); // `${songId}|${trackKey}`
  const parts = useMemo(() => listenParts(songs), [songs]);

  const saveName = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === playlist.name) return;
    const { ok } = await run(() => requestJson(url, { method: "PATCH", body: { name: name.trim() } }), { success: "Renamed" });
    if (ok) refresh().catch(() => {});
  };

  const edit = (updater) =>
    setData((list) => list.map((p) => (p.id === playlist.id ? { ...p, items: updater(p.items) } : p)));

  // Move one entry up or down. Shown at once; if the server says no, the real
  // order comes back.
  const move = async (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= playlist.items.length) return;
    const next = [...playlist.items];
    [next[i], next[j]] = [next[j], next[i]];
    edit(() => next.map((it, k) => ({ ...it, position: k })));
    const { ok } = await run(() => requestJson(`${url}/items`, { method: "PUT", body: { order: next.map((it) => it.id) } }));
    if (!ok) refresh().catch(() => {});
  };

  const removeItem = async (item) => {
    edit((items) => items.filter((it) => it.id !== item.id));
    const { ok } = await run(() => requestJson(`${url}/items/${item.id}`, { method: "DELETE" }));
    if (!ok) refresh().catch(() => {});
  };

  const addEntries = async (entries, doneMessage) => {
    if (!entries.length) return;
    const { ok } = await run(() => requestJson(`${url}/items`, { method: "POST", body: { entries } }), { success: doneMessage });
    if (ok) {
      setPicked(new Set());
      await refresh().catch(() => {});
    }
  };

  const togglePick = (songId, trackKey) =>
    setPicked((prev) => {
      const next = new Set(prev);
      const k = `${songId}|${trackKey}`;
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const addPicked = () => {
    // Songs in list order, each song's tracks in the standard order.
    const entries = [];
    for (const song of songs) {
      for (const t of songTrackOptions(song)) {
        if (picked.has(`${song.id}|${t.key}`)) entries.push({ program_song_id: song.id, track_key: t.key });
      }
    }
    addEntries(entries, `Added ${entries.length} track${entries.length === 1 ? "" : "s"}`);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={saveName} className="flex gap-2 items-end">
        <div className="flex-1 min-w-0">
          <label htmlFor="playlist-name" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">
            Name
          </label>
          <input id="playlist-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="sp-input" />
        </div>
        <button type="submit" disabled={!name.trim() || name.trim() === playlist.name} className="sp-btn-secondary sp-btn-compact disabled:opacity-60">
          Save
        </button>
      </form>

      <div>
        <p className="text-xs uppercase tracking-wide text-inkfaint mt-0 mb-1.5">
          In this playlist · {playlist.items.length}
        </p>
        {playlist.items.length === 0 ? (
          <p className="text-sm text-inkfaint m-0">Nothing yet. Add tracks below.</p>
        ) : (
          <ol className="list-none p-0 m-0 space-y-1">
            {playlist.items.map((it, i) => {
              const song = byId.get(it.program_song_id);
              const label = song ? trackLabelFor(song, it.track_key) : "";
              const hasLink = Boolean(song?.[it.track_key]);
              return (
                <li key={it.id} className="flex items-center gap-1 bg-paper border border-line rounded-lg pl-3 pr-1 min-h-[44px]">
                  <span className="text-inkfaint w-6 text-sm tabular-nums flex-shrink-0">{i + 1}.</span>
                  <span className={`flex-1 min-w-0 text-sm truncate ${hasLink ? "text-ink" : "text-inkfaint"}`}>
                    {song ? song.title : "Deleted song"}
                    <span className="text-inkfaint"> · {label || "track"}</span>
                    {!hasLink && <span className="text-inkfaint"> (no link, will skip)</span>}
                  </span>
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-inkfaint p-2 disabled:opacity-30" aria-label={`Move ${song?.title || "track"} up`}>
                    <ArrowUp size={16} />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === playlist.items.length - 1} className="text-inkfaint p-2 disabled:opacity-30" aria-label={`Move ${song?.title || "track"} down`}>
                    <ArrowDown size={16} />
                  </button>
                  <button onClick={() => removeItem(it)} className="text-inkfaint p-2" aria-label={`Remove ${song?.title || "track"} from playlist`}>
                    <X size={16} />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="sp-card space-y-3">
        <button onClick={() => setAdding((v) => !v)} aria-expanded={adding} className="w-full text-left text-sm font-semibold text-ink min-h-[36px]">
          {adding ? "Hide" : "Add tracks"}
        </button>
        {adding && (
          <>
            {parts.length > 0 && (
              <div>
                <p className="text-xs text-inkfaint mt-0 mb-1.5">Add a whole part, one track from every song that has it</p>
                <div className="flex gap-1.5 flex-wrap">
                  {parts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addEntries(entriesForPart(songs, p), `Added ${p.label} from ${p.own} song${p.own === 1 ? "" : "s"}`)}
                      className="text-xs font-semibold rounded-full px-3 py-1.5 bg-paper text-inkfaint border border-line"
                    >
                      + {p.label} · {p.own}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-inkfaint mt-0 mb-1.5">Or tick individual tracks</p>
              <ul className="list-none p-0 m-0 space-y-2">
                {songs.map((song) => {
                  const options = songTrackOptions(song);
                  if (!options.length) return null;
                  return (
                    <li key={song.id}>
                      <p className="text-sm text-ink mt-0 mb-1">{song.title}</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {options.map((t) => {
                          const on = picked.has(`${song.id}|${t.key}`);
                          return (
                            <button
                              key={t.key}
                              onClick={() => togglePick(song.id, t.key)}
                              aria-pressed={on}
                              className={`text-xs font-semibold rounded-full px-3 py-1.5 flex items-center gap-1 ${
                                on ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
                              }`}
                            >
                              {on && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex justify-end">
              <button onClick={addPicked} disabled={picked.size === 0} className="sp-btn-primary sp-btn-compact disabled:opacity-60">
                Add {picked.size || ""} track{picked.size === 1 ? "" : "s"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
