"use client";

import { useEffect } from "react";
import { X, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { useAudioQueue } from "./PlayerProvider";

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// v71_18 -- the player behind Listen by part (a setlist) and the Playlist tab (a
// program). It plays a QUEUE: a list of { pos, title, url, label, fellBack, note,
// short, counter } built by lib/listenQueue.js. It knows nothing about parts or
// playlists, so every mode shares one player.
//
//   items          the queue, in play order
//   skipped        [{ title }] left out because they had nothing to play
//   skippedPrefix  what to say before the skipped titles
//   controls       the mode / part chips, drawn above the player
//   title          the setlist or program name (lock screen "album")
//   embedded       true = sits inside a page; false = full-screen with a header + close
//   showLabels     show the kind of track on every row of the list, not only fallbacks
//
// When `items` changes (a different part, a toggle, a refreshed song list) the
// player keeps your place: it lands on the same song -- and does NOT restart the
// track that is playing unless a different track is now due.
//
// One <audio> element is reused for every track (its src is swapped), and the
// next track is started from the "ended" handler itself. Both matter for phones:
// a new element created while the screen is locked is usually refused, a reused
// one usually isn't. The Media Session block puts the song name and the play /
// next / previous buttons on the lock screen and in the car.
export default function QueuePlayer({ items, skipped = [], skippedPrefix = "Skipped, nothing to play:", controls = null, title, embedded = false, showLabels = false, onClose }) {
  const player = useAudioQueue();
  const { setQueue, registerViewer, step, playIndex, togglePlay, seek: seekTo } = player;

  // This screen is open: the mini bar hides, and closing it (with the mini
  // player OFF) stops the music.
  useEffect(() => registerViewer(), [registerViewer]);

  // Hand the queue to the shared player; it keeps your place when it changes.
  useEffect(() => {
    setQueue(items, title || "");
  }, [items, title, setQueue]);

  // The shared player may still hold an earlier list for a moment (before the
  // effect above runs), so index/current are read against THIS screen's items.
  const sameList = player.title === (title || "");
  const index = sameList ? Math.min(player.index, Math.max(items.length - 1, 0)) : 0;
  const current = items[index] || null;
  const playing = sameList && player.playing;
  const currentTime = sameList ? player.currentTime : 0;
  const duration = sameList ? player.duration : 0;
  const notice = sameList ? player.notice : "";

  const seek = (e) => seekTo(Number(e.target.value));

  const root = embedded ? "flex flex-col" : "fixed inset-0 bg-card z-[80] flex flex-col";

  return (
    <div className={root} {...(embedded ? {} : { role: "dialog", "aria-modal": "true", "aria-label": `Listen by part: ${title}` })}>
      {!embedded && (
        <div className="flex justify-between items-center gap-2 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 border-b border-linesoft flex-shrink-0">
          <div className="min-w-0">
            <h3 className="font-serif text-lg text-ink m-0 truncate">Listen by part</h3>
            <p className="text-xs text-inkfaint m-0 truncate">{title}</p>
          </div>
          <button onClick={onClose} className="text-inkfaint flex-shrink-0 p-1" aria-label="Close">
            <X size={22} />
          </button>
        </div>
      )}

      {controls && <div className="px-4 py-3 flex-shrink-0">{controls}</div>}

      <div className={`px-6 py-4 flex flex-col items-center gap-3 border-y border-linesoft flex-shrink-0 bg-paper ${embedded ? "rounded-xl border" : ""}`}>
        <p className="text-xs text-inkfaint m-0">{items.length ? current?.counter || "" : "Nothing to play"}</p>
        <p className="font-serif text-xl text-ink text-center m-0 min-h-[1.75rem]">{current?.title || ""}</p>
        <p
          className={showLabels ? "text-sm font-semibold text-accent m-0 min-h-[1.25rem]" : "text-xs text-inksoft m-0 min-h-[1rem]"}
          aria-live="polite"
        >
          {showLabels && current?.label ? `Track: ${current.label}` : current?.note || ""}
        </p>

        <div className="flex items-center gap-6">
          <button onClick={() => step(-1)} disabled={index <= 0} className="text-inkfaint p-2 disabled:opacity-30" aria-label="Previous">
            <SkipBack size={22} />
          </button>
          <button
            onClick={togglePlay}
            disabled={!items.length}
            className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center shadow-sm disabled:opacity-40"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="ml-1" />}
          </button>
          <button onClick={() => step(1)} disabled={index >= items.length - 1} className="text-inkfaint p-2 disabled:opacity-30" aria-label="Next">
            <SkipForward size={22} />
          </button>
        </div>

        <div className="w-full max-w-sm">
          <input type="range" min={0} max={duration || 0} value={currentTime} onChange={seek} aria-label="Seek" className="w-full accent-accent" />
          <div className="flex justify-between text-[0.6875rem] text-inkfaint mt-1 tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        {notice && <p role="status" className="text-xs text-inkfaint m-0 text-center">{notice}</p>}
      </div>

      <div className={embedded ? "pt-3" : "flex-1 min-h-0 overflow-y-auto px-4 py-3"}>
        <ol className="list-none p-0 m-0 space-y-1">
          {items.map((it, i) => {
            const newSong = showLabels && (i === 0 || items[i - 1].pos !== it.pos);
            return (
              <li key={`${it.pos}-${it.url}-${i}`} className={newSong && i > 0 ? "pt-2" : ""}>
                {newSong && (
                  <p className="m-0 px-3 pt-1 pb-0.5 text-sm font-semibold text-ink truncate">
                    Song {it.pos + 1}: {it.title}
                  </p>
                )}
                <button
                  onClick={() => playIndex(i)}
                  aria-current={i === index ? "true" : undefined}
                  className={`w-full text-left rounded-lg py-2 text-sm flex items-baseline gap-2 ${
                    showLabels ? "pl-6 pr-3" : "px-3"
                  } ${i === index ? "bg-accent/10 text-accent font-medium" : "text-ink"}`}
                >
                  <span className="text-inkfaint w-6 flex-shrink-0 tabular-nums">{i + 1}.</span>
                  {showLabels ? (
                    <span className="flex-1 min-w-0 truncate">{it.label}</span>
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 truncate">{it.title}</span>
                      {it.fellBack && <span className="text-[0.6875rem] text-inkfaint flex-shrink-0">{it.label}</span>}
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        {skipped.length > 0 && (
          <p className="text-xs text-inkfaint mt-3 mb-0">
            {skippedPrefix} {skipped.map((s) => s.title).join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
