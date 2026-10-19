"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, X } from "lucide-react";
import { toDirectDownloadUrl } from "@/lib/songMedia";
import { getMiniPlayerEnabled, MINI_PLAYER_EVENT } from "@/lib/miniPlayer";

// v71_22 -- the ONE audio player for the whole app. It used to live inside the
// Playlist / Listen-by-part screen, so leaving that screen stopped the music.
// Now it lives here, above every screen, and those screens (QueuePlayer) are
// just views of it. A small bar (the mini player) shows while something is
// loaded and no full player screen is open.
//
// What is kept from 71.20, on purpose:
//  - ONE reused <audio> element; src is swapped and the next track is started
//    from the "ended" handler (phones refuse a new element while locked).
//  - The lock-screen handlers are re-registered every time a track starts, the
//    seek handlers are cleared and no position state is set (that is what made
//    iPhones show next / previous instead of back 10 / forward 10).
const PlayerContext = createContext(null);

export function useAudioQueue() {
  return useContext(PlayerContext);
}

export default function PlayerProvider({ children }) {
  const audioRef = useRef(null);
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("");
  const [viewers, setViewers] = useState(0); // full player screens currently open
  const [miniOn, setMiniOn] = useState(false);

  const live = useRef({ items, index });
  live.current = { items, index };
  const playingRef = useRef(false);
  const currentRef = useRef(null);
  const titleRef = useRef("");
  const loadedRef = useRef(false);
  loadedRef.current = loaded;
  const miniOnRef = useRef(false);
  miniOnRef.current = miniOn;

  // The device setting, and changes to it from Settings.
  useEffect(() => {
    const sync = () => setMiniOn(getMiniPlayerEnabled());
    sync();
    window.addEventListener(MINI_PLAYER_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MINI_PLAYER_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    playingRef.current = false;
    currentRef.current = null;
    setPlaying(false);
    setLoaded(false);
    setItems([]);
    setIndex(0);
    setCurrentTime(0);
    setDuration(0);
    setNotice("");
    titleRef.current = "";
    setTitle("");
  }, []);

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
    setNotice("");
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
  const stepRef = useRef(step);
  stepRef.current = step;

  // A screen hands over its queue. A different list (different title) replaces
  // whatever was loaded; the same list changing (another part, a toggle, a
  // refreshed song list) keeps your place and does NOT restart the track that
  // is playing unless a different track is now due.
  const setQueue = useCallback((newItems, newTitle) => {
    if (titleRef.current !== newTitle && loadedRef.current) {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      playingRef.current = false;
      currentRef.current = null;
      setPlaying(false);
      setLoaded(false);
      setIndex(0);
      setNotice("");
    }
    titleRef.current = newTitle;
    setTitle(newTitle);
    setItems(newItems);

    const prev = currentRef.current;
    const isLoaded = loadedRef.current;
    if (!prev || !isLoaded) {
      if (prev) {
        let k = newItems.findIndex((it) => it.pos === prev.pos && it.url === prev.url);
        if (k === -1) k = newItems.findIndex((it) => it.pos >= prev.pos);
        setIndex(k === -1 ? 0 : k);
      } else {
        setIndex((i) => (i >= newItems.length ? 0 : i));
      }
      return;
    }
    let i = newItems.findIndex((it) => it.pos === prev.pos && it.url === prev.url);
    if (i === -1) i = newItems.findIndex((it) => it.pos >= prev.pos);
    if (i === -1) i = 0;
    const next = newItems[i];
    setIndex(i);
    if (!next) {
      audioRef.current?.pause();
      setLoaded(false);
      return;
    }
    if (next.url !== prev.url) {
      if (playingRef.current) playIndex(i, newItems);
      else {
        audioRef.current?.pause();
        setLoaded(false);
      }
    } else {
      currentRef.current = next;
    }
  }, [playIndex]);

  useEffect(() => {
    if (!loaded) currentRef.current = items[index] || currentRef.current;
  }, [items, index, loaded]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    const { items: list, index: i } = live.current;
    if (!audio || !list.length) return;
    if (!loadedRef.current) return playIndex(i);
    if (audio.paused) audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [playIndex]);

  const seek = useCallback((value) => {
    if (audioRef.current) audioRef.current.currentTime = value;
    setCurrentTime(value);
  }, []);

  // A full player screen opens / closes. Closing it with the mini player OFF
  // stops the music, exactly like before 71.22.
  const registerViewer = useCallback(() => {
    setViewers((n) => n + 1);
    return () => {
      setViewers((n) => Math.max(0, n - 1));
      if (!miniOnRef.current) stop();
    };
  }, [stop]);

  // Turning the mini player off while nothing is open to show it: stop.
  useEffect(() => {
    if (!miniOn && viewers === 0 && loaded) stop();
  }, [miniOn, viewers, loaded, stop]);

  const onEnded = () => {
    if (!step(1)) {
      setPlaying(false);
      playingRef.current = false;
      setNotice("That was the last one.");
    }
  };
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
  }, [registerLockScreen]);

  const current = items[index] || null;
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      if (!current || !loaded) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
      } else {
        navigator.mediaSession.metadata = new window.MediaMetadata({ title: current.title, artist: current.short, album: title });
      }
    } catch { /* ignore */ }
  }, [current, loaded, title]);

  const showMini = miniOn && loaded && viewers === 0 && Boolean(current);

  const value = {
    items, index, current, loaded, playing, currentTime, duration, notice, title,
    setQueue, playIndex, step, togglePlay, seek, stop, registerViewer,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
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
      {showMini && <MiniPlayer />}
    </PlayerContext.Provider>
  );
}

// The bar. Sits just above the bottom navigation on phones (which is ~4.5rem
// tall plus the home-indicator area) and in the corner on wide screens.
function MiniPlayer() {
  const { current, playing, index, items, togglePlay, step, stop, title, duration, currentTime } = useAudioQueue();
  const pct = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  return (
    <div
      role="region"
      aria-label="Now playing"
      className="fixed left-2 right-2 md:left-auto md:right-4 md:w-96 z-[60] bg-card border border-line rounded-2xl shadow-lg overflow-hidden bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4"
    >
      <div className="h-0.5 bg-line">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-1 pl-3 pr-1 py-1.5">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-semibold text-ink truncate">{current.title}</p>
          <p className="m-0 text-xs text-inkfaint truncate">
            {current.short || current.label}
            {title ? ` · ${title}` : ""}
          </p>
        </div>
        <button onClick={() => step(-1)} disabled={index <= 0} className="p-2.5 text-inkfaint disabled:opacity-30" aria-label="Previous">
          <SkipBack size={20} />
        </button>
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>
        <button onClick={() => step(1)} disabled={index >= items.length - 1} className="p-2.5 text-inkfaint disabled:opacity-30" aria-label="Next">
          <SkipForward size={20} />
        </button>
        <button onClick={stop} className="p-2.5 text-inkfaint" aria-label="Stop and close player">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
