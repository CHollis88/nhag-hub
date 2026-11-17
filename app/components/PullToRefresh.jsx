"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";

// Pull down to refresh (v71.29) -- the phone gesture that replaces the
// header's Refresh button on phones (the button stays on bigger screens and in
// Simple mode's Menu). Wraps a scrolling <main>: when it's scrolled to the
// very top, dragging down past THRESHOLD and letting go runs onRefresh().
// Only a clearly downward drag starting at the top counts, so ordinary
// scrolling never triggers it.
const THRESHOLD = 70;
const MAX_PULL = 110;

export default function PullToRefresh({ onRefresh, className = "", children }) {
  const ref = useRef(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const state = useRef({ startY: null, startX: 0, active: false, pull: 0 });
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const s = state.current;

    const onStart = (e) => {
      if (e.touches.length !== 1 || el.scrollTop > 0) {
        s.startY = null;
        return;
      }
      s.startY = e.touches[0].clientY;
      s.startX = e.touches[0].clientX;
      s.active = false;
      s.pull = 0;
    };
    const onMove = (e) => {
      if (s.startY == null) return;
      const dy = e.touches[0].clientY - s.startY;
      const dx = Math.abs(e.touches[0].clientX - s.startX);
      if (!s.active) {
        // Start only on a mostly-vertical downward drag while at the top.
        if (dy > 8 && dy > dx * 1.5 && el.scrollTop <= 0) s.active = true;
        else if (dy < 0 || dx > 12) {
          s.startY = null;
          return;
        } else return;
      }
      s.pull = Math.min(MAX_PULL, Math.max(0, dy * 0.5));
      setPull(s.pull);
    };
    const onEnd = async () => {
      const go = s.active && s.pull >= THRESHOLD;
      s.startY = null;
      s.active = false;
      if (go) {
        setRefreshing(true);
        setPull(THRESHOLD * 0.7);
        try {
          await onRefreshRef.current?.();
        } finally {
          setTimeout(() => {
            setRefreshing(false);
            setPull(0);
          }, 500);
        }
      } else {
        setPull(0);
      }
      s.pull = 0;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const shown = pull > 4 || refreshing;
  const ready = pull >= THRESHOLD;
  return (
    <main ref={ref} className={`relative overscroll-y-contain ${className}`}>
      <div
        aria-hidden={!refreshing}
        role={refreshing ? "status" : undefined}
        className="pointer-events-none absolute left-0 right-0 top-0 flex justify-center z-20"
        style={{ transform: `translateY(${Math.max(0, pull - 36)}px)`, opacity: shown ? 1 : 0, transition: state.current.active ? "none" : "transform 0.2s, opacity 0.2s" }}
      >
        <span className="mt-2 w-9 h-9 rounded-full bg-card shadow-md border border-line flex items-center justify-center">
          <RotateCw
            size={18}
            className={`text-accent ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
            style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)`, opacity: ready ? 1 : 0.6 }}
          />
          {refreshing && <span className="sr-only">Refreshing</span>}
        </span>
      </div>
      <div style={{ transform: pull ? `translateY(${pull * 0.6}px)` : undefined, transition: state.current.active ? "none" : "transform 0.2s" }}>
        {children}
      </div>
    </main>
  );
}
