"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readScreenState, writeScreenState } from "@/lib/resourceCache";

// v71 #43 -- like useState, but the value survives leaving the screen and coming
// back (switching tabs unmounts the screen). For the search text, filter and
// view choices on a list. Forgotten at sign-out. `key` should be specific to the
// screen AND what it is showing, e.g. `songs:${groupId}:query`.
export function useScreenState(key, initial) {
  const [value, setValue] = useState(() => readScreenState(key, initial));
  const set = useCallback(
    (next) =>
      setValue((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        writeScreenState(key, resolved);
        return resolved;
      }),
    [key]
  );
  return [value, set];
}

// v71 #43 -- remembers how far a list was scrolled. The app scrolls inside its
// <main> element (not the window), so this finds the enclosing <main>.
//
//   const anchor = useScrollMemory(`songs:${groupId}`, songs !== null);
//   <div ref={anchor} />   // anywhere inside the screen
//
// `ready` should turn true once the content is on screen (so there is something
// tall enough to scroll to); the saved position is restored ONCE at that point.
// Position is saved as you scroll.
export function useScrollMemory(key, ready = true) {
  const anchorRef = useRef(null);
  const restored = useRef(false);

  const scroller = () => anchorRef.current?.closest("main") || null;

  useEffect(() => {
    restored.current = false;
  }, [key]);

  useEffect(() => {
    if (!ready || restored.current) return;
    const el = scroller();
    if (!el) return;
    restored.current = true;
    const saved = readScreenState(`scroll:${key}`, 0);
    if (saved > 0) el.scrollTop = saved;
  }, [ready, key]);

  // Saved on every scroll event, NOT when leaving: by the time an unmount runs,
  // the next screen's (shorter) content may already have clamped scrollTop, and
  // we'd remember the wrong spot. A Map.set per scroll event costs nothing.
  useEffect(() => {
    const el = scroller();
    if (!el) return undefined;
    const onScroll = () => {
      // Don't overwrite the remembered spot while we're still waiting to restore it.
      if (restored.current) writeScreenState(`scroll:${key}`, el.scrollTop);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [key]);

  return anchorRef;
}
