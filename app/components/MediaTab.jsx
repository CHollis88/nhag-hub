"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, FileText, Guitar, FileMusic, Mic2, Headphones, X, ExternalLink } from "lucide-react";
import { SkeletonRowList } from "./Skeleton";
import EmptyState from "./EmptyState";

// Same fields SongForm/SongsTab already read and write -- this tab
// doesn't add any new data, it just gives every existing link an
// inline player/viewer instead of "opens a new tab and leaves the app".
const MEDIA_FIELDS = [
  ["sheet_music_url", "Sheet Music", FileMusic, "pdf"],
  ["lyrics_url", "Lyrics", FileText, "pdf"],
  ["chords_url", "Chords", Guitar, "pdf"],
  ["soprano_url", "Soprano", Mic2, "audio"],
  ["alto_url", "Alto", Mic2, "audio"],
  ["tenor_url", "Tenor", Mic2, "audio"],
  ["bass_url", "Bass", Mic2, "audio"],
  ["split_track_url", "Split Track", Mic2, "audio"],
  ["demo_url", "Demo", Headphones, "audio"],
];

// Drive's own /preview endpoint renders a native player for whatever
// the file actually is -- a PDF viewer for PDFs, an audio player UI
// for audio files -- so the same iframe embed works for every field
// here without needing to know the real content type ourselves. Only
// works for drive.google.com/file/d/<ID>/... links; anything else
// (someone pasted a Dropbox link, etc.) falls back to a plain
// "Open" link instead of trying to embed it.
function toEmbedUrl(url) {
  const match = url?.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (!match) return null;
  return `https://drive.google.com/file/d/${match[1]}/preview`;
}

export default function MediaTab({ groupId, baseUrl }) {
  const [songs, setSongs] = useState(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // song object
  const [activeField, setActiveField] = useState(null); // e.g. "sheet_music_url"

  const url = baseUrl || `/api/groups/${groupId}/songs`;

  const load = useCallback(async () => {
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) setSongs(data.songs || data);
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  // Only songs with at least one playable/viewable link are worth
  // showing here -- a song with no media yet just clutters this list.
  const withMedia = useMemo(
    () => (songs || []).filter((s) => MEDIA_FIELDS.some(([key]) => s[key])),
    [songs]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return withMedia;
    const q = query.toLowerCase();
    return withMedia.filter((s) => s.title.toLowerCase().includes(q));
  }, [withMedia, query]);

  const openSong = (song) => {
    setSelected(song);
    const firstField = MEDIA_FIELDS.find(([key]) => song[key]);
    setActiveField(firstField ? firstField[0] : null);
  };

  const activeUrl = selected && activeField ? selected[activeField] : null;
  const embedUrl = activeUrl ? toEmbedUrl(activeUrl) : null;

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-4">Media</h2>

      {songs !== null && withMedia.length > 3 && (
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs..."
            className="sp-input pl-9"
          />
        </div>
      )}

      {songs === null && <SkeletonRowList count={5} />}
      {songs !== null && withMedia.length === 0 && (
        <EmptyState icon={Headphones} text="No songs have sheet music, lyrics, or tracks attached yet." />
      )}
      {withMedia.length > 0 && filtered.length === 0 && (
        <EmptyState icon={Search} text="No songs match that search." />
      )}

      <div className="space-y-1.5">
        {filtered.map((song) => {
          const available = MEDIA_FIELDS.filter(([key]) => song[key]);
          return (
            <button
              key={song.id}
              onClick={() => openSong(song)}
              className="sp-card text-left block w-full flex items-center justify-between gap-2"
            >
              <span className="font-medium text-ink truncate">{song.title}</span>
              <span className="flex gap-1 flex-shrink-0">
                {available.map(([key, label, Icon]) => (
                  <Icon key={key} size={14} className="text-inkfaint" />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-[70]" onClick={() => setSelected(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-t-2xl w-full max-h-[90vh] flex flex-col p-4"
          >
            <div className="flex justify-between items-center mb-3 gap-2">
              <h3 className="font-serif text-lg text-ink m-0 min-w-0 truncate">{selected.title}</h3>
              <button onClick={() => setSelected(null)} className="text-2xl text-inkfaint leading-none flex-shrink-0">×</button>
            </div>

            <div className="flex gap-1.5 flex-wrap mb-3">
              {MEDIA_FIELDS.filter(([key]) => selected[key]).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setActiveField(key)}
                  className={`text-xs font-semibold rounded-full px-3 py-1.5 flex items-center gap-1 ${
                    activeField === key ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
                  }`}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-[50vh] rounded-xl overflow-hidden bg-paper">
              {embedUrl ? (
                <iframe src={embedUrl} className="w-full h-full min-h-[50vh]" allow="autoplay" />
              ) : activeUrl ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <p className="text-sm text-inkfaint">This link can't be previewed inline.</p>
                  <a
                    href={activeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sp-btn-secondary flex items-center gap-1.5"
                  >
                    Open <ExternalLink size={13} />
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
