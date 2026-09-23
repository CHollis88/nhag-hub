"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { toDirectDownloadUrl, toEmbedUrl } from "@/lib/songMedia";

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * A real <audio> element with app-styled controls, instead of Google's
 * own black embedded player. Not guaranteed to work for every file --
 * see toDirectDownloadUrl()'s comment -- so this quietly falls back to
 * the Drive /preview iframe (Google's player) if the direct link fails
 * to load or decode as audio, rather than showing a dead player.
 *
 * `compact` switches between a slim single-row layout (for the mini
 * player bar that shows alongside a pdf) and a larger centered one
 * (audio has the whole screen to itself) -- but the <audio> element
 * itself is always rendered in the exact same spot, as the first child
 * of one single wrapping div, regardless of which layout is active.
 * That's deliberate: if `compact` toggling ever caused <audio> to move
 * to a different position in the tree (e.g. two separate `return`
 * branches), React would tear it down and recreate it, silently
 * restarting playback the moment someone opens a pdf alongside it.
 */
export default function NativeAudioPlayer({ url, label, compact = false }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  const directUrl = toDirectDownloadUrl(url);

  // A new track was picked -- reset playback state and give the direct
  // link a fresh chance.
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setFailed(false);
  }, [url]);

  if (!directUrl || failed) {
    const embedUrl = toEmbedUrl(url);
    if (embedUrl) {
      return <iframe src={embedUrl} className="w-full h-full border-0" allow="autoplay" />;
    }
    return (
      <div className="h-full flex items-center justify-center px-4">
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">
          Open track
        </a>
      </div>
    );
  }

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      // play() rejects if the browser couldn't actually start playback
      // (e.g. it decided the source isn't valid audio) -- a real-world
      // failure mode worth falling back on, same as onError below.
      audioRef.current.play().catch(() => setFailed(true));
    }
  };

  const onLoadedMetadata = () => {
    const d = audioRef.current?.duration;
    // Drive's "can't scan for viruses" interstitial is an HTML page,
    // not audio -- browsers sometimes "succeed" at loading it as a
    // zero-byte or non-finite-duration track rather than firing a
    // clean error, so this is a second line of defense past onError.
    if (!d || !isFinite(d)) {
      setFailed(true);
      return;
    }
    setDuration(d);
  };

  const seek = (e) => {
    const value = Number(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  return (
    <div className={compact ? "h-full flex items-center gap-3 px-4" : "h-full flex flex-col items-center justify-center gap-4 px-6"}>
      <audio
        ref={audioRef}
        src={directUrl}
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />

      <button
        onClick={togglePlay}
        className={
          compact
            ? "flex-shrink-0 w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center"
            : "w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center shadow-sm"
        }
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <Pause size={compact ? 15 : 26} fill="currentColor" />
        ) : (
          <Play size={compact ? 15 : 26} fill="currentColor" className={compact ? "ml-0.5" : "ml-1"} />
        )}
      </button>

      {!compact && <p className="text-sm font-medium text-ink text-center">{label}</p>}

      <div className={compact ? "flex-1 min-w-0" : "w-full max-w-xs"}>
        {compact && <p className="text-xs font-medium text-ink truncate mb-1">{label}</p>}
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={currentTime}
          onChange={seek}
          className={compact ? "w-full h-1 accent-accent" : "w-full accent-accent"}
        />
        {!compact && (
          <div className="flex justify-between text-[0.6875rem] text-inkfaint mt-1 tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        )}
      </div>

      {compact && (
        <span className="text-[0.6875rem] text-inkfaint flex-shrink-0 tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      )}
    </div>
  );
}
