"use client";

import { useState } from "react";
import { X, SkipBack, SkipForward } from "lucide-react";
import { SONG_MEDIA_FIELDS } from "@/lib/songMedia";
import NativeAudioPlayer from "./NativeAudioPlayer";
import NativeDocViewer from "./NativeDocViewer";
import MediaErrorBoundary from "./MediaErrorBoundary";

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
  // Just the audio ones, in the same fixed order as SONG_MEDIA_FIELDS
  // (Soprano, Alto, Tenor, Bass, Split Track, Demo) -- what the
  // forward/back buttons cycle through. Pdf fields aren't part of this
  // cycle; they're switched independently via their own pills.
  const audioFields = available.filter(([, , , type]) => type === "audio");

  const selectField = (key, type) => {
    if (type === "audio") {
      setPlayingField(key);
    } else {
      // Tapping the pdf pill that's already showing toggles it off
      // (back to audio-only, or "nothing linked" if nothing's
      // playing) -- without this, once a pdf was picked there was no
      // way back to the plain audio view short of closing the whole
      // viewer.
      setViewingField((prev) => (prev === key ? null : key));
    }
  };

  const currentIndex = audioFields.findIndex(([key]) => key === playingField);
  // Wraps around at either end -- treated like a real player's
  // next/prev, not a "disable at the edges" control, since cycling
  // straight from Bass back to Soprano is more useful mid-rehearsal
  // than hitting a dead end.
  const goToTrack = (delta) => {
    if (audioFields.length === 0) return;
    const base = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (base + delta + audioFields.length) % audioFields.length;
    setPlayingField(audioFields[nextIndex][0]);
  };

  const viewingUrl = viewingField ? song[viewingField] : null;
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

      {/* Skip-track row: only shown when a song has more than one audio
          field, so switching parts mid-rehearsal doesn't require
          tapping a specific pill each time. Sits above the content
          area, visible in both the audio-only and audio+pdf layouts. */}
      {playingField && audioFields.length > 1 && (
        <div className="flex items-center justify-center gap-4 px-4 py-2 border-b border-linesoft flex-shrink-0">
          <button onClick={() => goToTrack(-1)} className="text-inkfaint p-1" aria-label="Previous track">
            <SkipBack size={18} />
          </button>
          <span className="text-xs text-inkfaint min-w-[5rem] text-center">{playingLabel}</span>
          <button onClick={() => goToTrack(1)} className="text-inkfaint p-1" aria-label="Next track">
            <SkipForward size={18} />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        {viewingField && (
          <div className="flex-1 min-h-0 bg-paper">
            <MediaErrorBoundary resetKey={viewingField}>
              <NativeDocViewer url={viewingUrl} />
            </MediaErrorBoundary>
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
            <MediaErrorBoundary resetKey={playingField}>
              <NativeAudioPlayer url={playingUrl} label={playingLabel} compact={!!viewingField} />
            </MediaErrorBoundary>
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
