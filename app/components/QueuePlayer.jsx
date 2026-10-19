"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { toDirectDownloadUrl } from "@/lib/songMedia";

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
  const audioRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false); // has a src been set yet?
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [notice, setNotice] = useState("");

  // Latest values for handlers that outlive a render (ended, media-session buttons).
  const live = useRef({ items, index });
  live.current = { items, index };
  const playingRef = useRef(false);
  const currentRef = useRef(null); // the item showing as of the last render

  const current = items[index] || null;

  // Set the src and start it. Called straight from a tap or from "ended" so the
  // browser counts it as allowed playback.
  const playIndex = useCallback((i, fromItems) => {
    const list = fromItems || live.current.items;
    const item = list[i];
    const audio = audioRef.current;
    if (!item || !audio) return;
    const src = toDirectDownloadUrl(item.url);
    if (!src) return;
    setIndex(i);
    setCurrentTime(0);
    setDuration(0);
    setLoaded(true);
    currentRef.current = item;
    audio.src = src;
    audio.play().catch(() => setPlaying(false));
  }, []);

  const step = useCallback((delta) => {
    const { items: list, index: i } = live.current;
    const next = i + delta;
    if (next < 0 || next >= list.length) return false;
    playIndex(next);
    return true;
  }, [playIndex]);

  // The queue changed. Keep the place; only reload audio if another track is due.
  useEffect(() => {
    const prev = currentRef.current;
    if (!prev || !loaded) {
      // Nothing started yet (or it was stopped): just show the right row.
      setIndex((i) => (i >= items.length ? 0 : i));
      if (prev) {
        let k = items.findIndex((it) => it.pos === prev.pos && it.url === prev.url);
        if (k === -1) k = items.findIndex((it) => it.pos >= prev.pos);
        setIndex(k === -1 ? 0 : k);
      }
      return;
    }
    let i = items.findIndex((it) => it.pos === prev.pos && it.url === prev.url);
    if (i === -1) i = items.findIndex((it) => it.pos >= prev.pos);
    if (i === -1) i = 0;
    const next = items[i];
    setIndex(i);
    if (!next) {
      audioRef.current?.pause();
      setLoaded(false);
      return;
    }
    if (next.url !== prev.url) {
      if (playingRef.current) playIndex(i, items);
      else {
        audioRef.current?.pause();
        setLoaded(false);
      }
    } else {
      currentRef.current = next;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    if (!loaded) currentRef.current = items[index] || currentRef.current;
  }, [items, index, loaded]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !items.length) return;
    if (!loaded) return playIndex(index);
    if (audio.paused) audio.play().catch(() => setPlaying(false));
    else audio.pause();
  };

  const onEnded = () => {
    if (!step(1)) {
      setPlaying(false);
      playingRef.current = false;
      setNotice("That was the last one.");
    }
  };

  // A file that won't play is skipped, not stuck on.
  const onError = () => {
    const item = live.current.items[live.current.index];
    if (!item) return;
    setNotice(`Couldn't play "${item.title}" (${item.label}), skipped it.`);
    if (!step(1)) setPlaying(false);
  };

  const onLoadedMetadata = () => {
    const d = audioRef.current?.duration;
    if (!d || !isFinite(d)) return onError(); // Drive's HTML "can't scan" page, not audio
    setDuration(d);
  };

  const seek = (e) => {
    const value = Number(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  // Lock screen / car controls. iPhones only show next / previous track (and not
  // the podcast-style "back 10 / forward 10") if those handlers are registered
  // while audio is actually playing, and if no seek handlers or position state
  // are set. So this runs on mount AND every time a track starts, and it
  // deliberately clears the seek handlers.
  const stepRef = useRef(step);
  stepRef.current = step;
  const registerLockScreen = useCallback(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (action, fn) => {
      try { ms.setActionHandler(action, fn); } catch { /* not supported here */ }
    };
    set("play", () => audioRef.current?.play().catch(() => {}));
    set("pause", () => audioRef.current?.pause());
    set("nexttrack", () => stepRef.current(1));
    set("previoustrack", () => stepRef.current(-1));
    set("seekbackward", null);
    set("seekforward", null);
    set("seekto", null);
  }, []);

  useEffect(() => {
    registerLockScreen();
    return () => {
      if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
      const ms = navigator.mediaSession;
      for (const a of ["play", "pause", "nexttrack", "previoustrack", "seekbackward", "seekforward", "seekto"]) {
        try { ms.setActionHandler(a, null); } catch { /* ignore */ }
      }
      try { ms.metadata = null; ms.playbackState = "none"; } catch { /* ignore */ }
    };
  }, [registerLockScreen]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !current || !loaded) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({ title: current.title, artist: current.short, album: title });
    } catch { /* ignore */ }
  }, [current, loaded, title]);

  // Leaving the screen stops the music.
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
    };
  }, []);

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

      <audio
        ref={audioRef}
        preload="auto"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onPlay={() => {
          playingRef.current = true;
          setPlaying(true);
          registerLockScreen();
          try { navigator.mediaSession.playbackState = "playing"; } catch { /* ignore */ }
        }}
        onPlaying={registerLockScreen}
        onPause={() => {
          playingRef.current = false;
          setPlaying(false);
          try { navigator.mediaSession.playbackState = "paused"; } catch { /* ignore */ }
        }}
        onEnded={onEnded}
        onError={onError}
      />

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
