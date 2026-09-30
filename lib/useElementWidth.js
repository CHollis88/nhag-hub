"use client";

import { useEffect, useState } from "react";

// The current width (px) of the element `ref` points at, kept up to date as it
// changes. It measures the ELEMENT, not the browser window: a component in a
// narrow pane of a two-pane layout is narrow even on a huge monitor, and that is
// what layout decisions should follow. Reports 0 until measured (and where
// measuring isn't possible), which callers treat as "narrow" -- the safe layout.
export function useElementWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width));
    measure();
    let observer = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(el);
    }
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);
  return width;
}
