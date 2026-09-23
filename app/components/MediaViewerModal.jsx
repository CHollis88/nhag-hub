"use client";

import { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { SONG_MEDIA_FIELDS, toEmbedUrl } from "@/lib/songMedia";
import NativeAudioPlayer from "./NativeAudioPlayer";

// Full-screen inline viewer/player -- shared by SongsTab (tapping a
// link button on a song), and identical for Choir's main library and
// every Program's song library (same `song` shape either way).
//
// Playing and viewing are tracked separately on purpose: tapping an
// audio pill (Soprano, Split Track, etc.) starts/switches what's
// playing; tapping a pdf pill (Lyrics, Chords, Sheet Music) only
// changes what's shown above it. NativeAudioPlayer (rendered below) is
// a single stable element that stays in the exact same spot in the
// tree the whole time -- only its wrapping div's height changes
// (full-size when nothing's being viewed, a mini bar once a pdf is).
// Because it never moves to a different branch of the JSX and its
// `url` prop doesn't change just from picking a pdf, playback isn't
// interrupted by switching to Lyrics.
export default function MediaViewerModal({ song, initialField, onClose }) {
  const initialType = SONG_MEDIA_FIELDS.find(([key]) => key === initialField)?.[3];
  const [viewingField, setViewingField] = useState(initialType === "pdf" ? initialField : null);
  const [playingField, setPlayingField] = useState(initialType === "audio" ? initialField : null);

  const available = SONG_MEDIA_FIELDS.filter(([key]) => song[key]);

  const selectField = (key, type) => {
    if (type === "audio") setPlayingField(key);
    else setViewingField(key);
  };

  const viewingUrl = viewingField ? song[viewingField] : null;
  const viewingEmbed = viewingUrl ? toEmbedUrl(viewingUrl) : null;
  const playingUrl = playingField ? song[playingField] : null;
  const playingLabel = SONG_MEDIA_FIELDS.find(([key]) => key === playingField)?.[1];

  return (
    <div className="fixed inset-0 bg-card z-[80] flex flex-col">
      <div className="flex justify-between items-center gap-2 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 border-b border-linesoft flex-shrink-0">
        <h3 className="font-serif text-lg text-ink m-0 min-w-0 truncate">{song.title}</h3>
        <button onClick={onClose} className="text-inkfaint flex-shrink-0 p-1" aria-label="Close">
          <X size={22} />
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap px-4 py-3 flex-shrink-0">
        {available.map(([key, label, Icon, type]) => {
          const active = type === "audio" ? key === playingField : key === viewingField;
          return (
            <button
              key={key}
              onClick={() => selectField(key, type)}
              className={`text-xs font-semibold rounded-full px-3 py-1.5 flex items-center gap-1 ${
                active ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {viewingField && (
          <div className="flex-1 min-h-0 bg-paper">
            {viewingEmbed ? (
              <iframe src={viewingEmbed} className="w-full h-full border-0" allow="autoplay" />
            ) : (
              <UnpreviewableFallback url={viewingUrl} />
            )}
          </div>
        )}

        {/* NativeAudioPlayer is always rendered in this same spot
            whenever playingField is set -- only the wrapping div's
            height changes (full-size when nothing's being viewed, a
            mini bar once a pdf is). NativeAudioPlayer itself keeps its
            <audio> element stable across its own compact/full layout
            switch (see that component's comment), so nothing here
            interrupts playback just from opening Lyrics. */}
        {playingField && (
          <div
            className={
              viewingField
                ? "h-24 border-t border-linesoft flex-shrink-0 bg-paper"
                : "flex-1 min-h-0 bg-paper"
            }
          >
            <NativeAudioPlayer url={playingUrl} label={playingLabel} compact={!!viewingField} />
          </div>
        )}

        {!viewingField && !playingField && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-inkfaint">Nothing linked yet for this song.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function UnpreviewableFallback({ url }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-inkfaint">This link can't be previewed inline.</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="sp-btn-secondary flex items-center gap-1.5">
        Open <ExternalLink size={13} />
      </a>
    </div>
  );
}
