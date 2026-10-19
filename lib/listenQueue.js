// v71_17 -- "Listen by part": turn a setlist's songs into a play queue for ONE
// part (Alto, Split Track, a custom track...), with the fallback rules Cam chose:
//
//   a built-in part (Soprano/Alto/Tenor/Bass):  that part -> Split Track -> Demo -> skip
//   Split Track:                                Split Track -> Demo -> skip
//   Demo:                                       Demo -> Split Track -> skip
//   a custom track (e.g. "Soprano - Lowered"):  that track only -> otherwise SKIP
//     (a lowered-key playlist must never quietly play the normal key)
//
// Pure functions, no React, so the rules are easy to test.
import { toDirectDownloadUrl } from "@/lib/songMedia";

export const BUILT_IN_PARTS = [
  { id: "split_track_url", label: "Split Track" },
  { id: "soprano_url", label: "Soprano" },
  { id: "alto_url", label: "Alto" },
  { id: "tenor_url", label: "Tenor" },
  { id: "bass_url", label: "Bass" },
  { id: "demo_url", label: "Demo" },
];

const norm = (s) => (s || "").trim().toLowerCase();
const playable = (url) => Boolean(url && toDirectDownloadUrl(url));

// The custom tracks one song has filled in: [{ name, url }]
function customTracks(song) {
  const out = [];
  for (const n of [1, 2, 3]) {
    const url = song?.[`extra${n}_url`];
    if (!url) continue;
    out.push({ name: (song[`extra${n}_label`] || "").trim() || `Track ${n}`, url });
  }
  return out;
}

// Which one track plays for this song under this part. null = nothing (skip).
// Returns { url, label, fellBack } where label names what is REALLY playing.
export function resolveTrack(song, part) {
  if (!song) return null;
  if (part.custom) {
    const hit = customTracks(song).find((t) => norm(t.name) === norm(part.label) && playable(t.url));
    return hit ? { url: hit.url, label: hit.name, fellBack: false } : null;
  }
  const order =
    part.id === "split_track_url"
      ? ["split_track_url", "demo_url"]
      : part.id === "demo_url"
        ? ["demo_url", "split_track_url"]
        : [part.id, "split_track_url", "demo_url"];
  for (const key of order) {
    if (playable(song[key])) {
      const label = BUILT_IN_PARTS.find((p) => p.id === key).label;
      return { url: song[key], label, fellBack: key !== part.id };
    }
  }
  return null;
}

// Every part worth offering for these songs, in a fixed order, with how many
// songs have a real track of that part ("own") and how many would still play
// via the fallback ("fallback"). Parts nobody has are left out.
export function listenParts(songs) {
  const parts = [];
  for (const p of BUILT_IN_PARTS) {
    const part = { ...p, custom: false };
    const own = songs.filter((s) => playable(s[p.id])).length;
    if (own === 0) continue;
    const playableCount = songs.filter((s) => resolveTrack(s, part)).length;
    parts.push({ ...part, own, fallback: playableCount - own, total: songs.length });
  }
  // Custom tracks are grouped by NAME (capitals ignored), keeping the first spelling seen.
  const seen = new Map();
  for (const s of songs) {
    for (const t of customTracks(s)) {
      if (!playable(t.url)) continue;
      const k = norm(t.name);
      if (!seen.has(k)) seen.set(k, { label: t.name, own: 0 });
      seen.get(k).own += 1;
    }
  }
  for (const { label, own } of seen.values()) {
    parts.push({ id: `custom:${norm(label)}`, label, custom: true, own, fallback: 0, total: songs.length });
  }
  return parts;
}

// The queue for one part. Each item keeps `pos` (its place in the setlist /
// program) so switching parts can land on the same song. Songs with nothing to
// play are returned in `skipped`.
//
// Every queue item has the same shape, whichever mode built it:
//   { pos, title, url, label, fellBack, note, short, counter }
//   label    what is REALLY playing ("Split Track")
//   note     the line shown under the title
//   short    the lock-screen "artist" line
//   counter  "Song 3 of 9"
export function buildQueue(songs, part) {
  const items = [];
  const skipped = [];
  songs.forEach((song, pos) => {
    const track = resolveTrack(song, part);
    if (track) {
      items.push({
        pos,
        title: song.title,
        ...track,
        note: track.fellBack ? `${track.label} — no ${part.label} track for this song` : track.label,
        short: track.fellBack ? `${track.label} (no ${part.label} track)` : track.label,
      });
    } else skipped.push({ pos, title: song.title });
  });
  items.forEach((it, i) => {
    it.counter = `Song ${i + 1} of ${items.length}`;
  });
  return { items, skipped };
}

// ---------------------------------------------------------------------------
// "By song": every track of song 1, then every track of song 2, ... in a fixed
// order. Only tracks a song really has play (nothing falls back -- it is already
// playing everything), and the person can switch kinds of track off.
// ---------------------------------------------------------------------------
export const BY_SONG_ORDER = ["demo_url", "split_track_url", "soprano_url", "alto_url", "tenor_url", "bass_url"];
const BY_SONG_LABELS = Object.fromEntries(BUILT_IN_PARTS.map((p) => [p.id, p.label]));

// The on/off switches for By song: one per kind of track any song has.
export function byTrackToggles(songs) {
  const toggles = [];
  for (const id of BY_SONG_ORDER) {
    const count = songs.filter((s) => playable(s[id])).length;
    if (count) toggles.push({ id, label: BY_SONG_LABELS[id], count });
  }
  const seen = new Map();
  for (const s of songs) {
    for (const t of customTracks(s)) {
      if (!playable(t.url)) continue;
      const k = norm(t.name);
      if (!seen.has(k)) seen.set(k, { id: `custom:${k}`, label: t.name, count: 0 });
      seen.get(k).count += 1;
    }
  }
  return [...toggles, ...seen.values()];
}

// `enabled` is a Set of toggle ids. Songs with none of the enabled tracks are skipped.
export function buildSongQueue(songs, enabled) {
  const items = [];
  const skipped = [];
  const songCount = songs.length;
  songs.forEach((song, pos) => {
    const tracks = [];
    for (const id of BY_SONG_ORDER) {
      if (enabled.has(id) && playable(song[id])) tracks.push({ url: song[id], label: BY_SONG_LABELS[id] });
    }
    for (const t of customTracks(song)) {
      if (enabled.has(`custom:${norm(t.name)}`) && playable(t.url)) tracks.push({ url: t.url, label: t.name });
    }
    if (!tracks.length) {
      skipped.push({ pos, title: song.title });
      return;
    }
    tracks.forEach((t, i) => {
      items.push({
        pos,
        title: song.title,
        url: t.url,
        label: t.label,
        fellBack: false,
        note: t.label,
        short: t.label,
        counter: `Song ${pos + 1} of ${songCount} · track ${i + 1} of ${tracks.length}`,
      });
    });
  });
  return { items, skipped };
}

// ---------------------------------------------------------------------------
// "Custom": a saved playlist -- specific tracks of specific songs in the
// person's own order. `entries` are { program_song_id, track_key } in order.
// An entry whose song is gone, or whose link has been emptied, is skipped.
// ---------------------------------------------------------------------------
export function trackLabelFor(song, key) {
  if (BY_SONG_LABELS[key]) return BY_SONG_LABELS[key];
  const n = Number(key.match(/^extra(\d)_url$/)?.[1]);
  return (song?.[`extra${n}_label`] || "").trim() || `Track ${n}`;
}

export function buildCustomQueue(songs, entries) {
  const byId = new Map(songs.map((s) => [s.id, s]));
  const items = [];
  const skipped = [];
  entries.forEach((e, pos) => {
    const song = byId.get(e.program_song_id);
    const label = song ? trackLabelFor(song, e.track_key) : "";
    if (song && playable(song[e.track_key])) {
      items.push({ pos, entryId: e.id, title: song.title, url: song[e.track_key], label, fellBack: false, note: label, short: label });
    } else {
      skipped.push({ pos, title: song ? `${song.title} (${label})` : "A deleted song" });
    }
  });
  items.forEach((it, i) => {
    it.counter = `Track ${i + 1} of ${items.length}`;
  });
  return { items, skipped };
}

// The tracks one song can put in a playlist, in the standard order:
// [{ key: "alto_url", label: "Alto" }, ...] -- only ones with a playable link.
export function songTrackOptions(song) {
  const out = [];
  for (const id of BY_SONG_ORDER) {
    if (playable(song[id])) out.push({ key: id, label: BY_SONG_LABELS[id] });
  }
  for (const n of [1, 2, 3]) {
    const key = `extra${n}_url`;
    if (playable(song[key])) out.push({ key, label: trackLabelFor(song, key) });
  }
  return out;
}

// "Add Alto from every song": one entry per song that REALLY has that part
// (no fallback -- a playlist holds exactly what you add).
export function entriesForPart(songs, part) {
  const out = [];
  for (const song of songs) {
    if (!part.custom) {
      if (playable(song[part.id])) out.push({ program_song_id: song.id, track_key: part.id });
      continue;
    }
    for (const n of [1, 2, 3]) {
      const key = `extra${n}_url`;
      if (playable(song[key]) && norm(trackLabelFor(song, key)) === norm(part.label)) {
        out.push({ program_song_id: song.id, track_key: key });
        break;
      }
    }
  }
  return out;
}
