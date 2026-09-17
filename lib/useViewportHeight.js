"use client";

import { useEffect, useState } from "react";

// The actual visible viewport height in pixels, kept live as it changes
// -- including when an on-screen keyboard opens. `100dvh` alone isn't
// reliable for this: several mobile browsers don't shrink it for the
// keyboard at all (the keyboard overlays content instead of resizing
// the layout viewport), which is exactly what caused a bottom-pinned
// compose bar to end up hidden behind the keyboard or behind the bottom
// nav, or a short conversation to show a stray gap where the layout
// still assumed the pre-keyboard height. Reading window.visualViewport
// directly sidesteps that inconsistency and gives every screen that
// uses it a height binding that's actually correct on every device.
export function useViewportHeight() {
  const [height, setHeight] = useState(() =>
    typeof window === "undefined" ? 0 : window.visualViewport?.height || window.innerHeight
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const update = () => setHeight(vv?.height || window.innerHeight);
    update();
    vv?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return height;
}
