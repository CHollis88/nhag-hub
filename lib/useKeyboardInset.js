"use client";

import { useEffect, useState } from "react";

// Pixels currently covered by an on-screen keyboard (0 when none is
// open). Used to pin a `position: fixed` element -- a chat compose bar
// -- exactly above the keyboard.
//
// `bottom: 0` alone on a fixed element pins to the LAYOUT viewport's
// bottom edge, which several mobile browsers don't move when the
// keyboard opens (the keyboard overlays content instead of resizing the
// layout viewport) -- exactly why a bottom-pinned compose bar could end
// up hidden underneath it. Reading window.visualViewport instead gives
// the actual visible area, keyboard excluded, on every browser.
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;

    const update = () => {
      const covered = window.innerHeight - (vv.height + vv.offsetTop);
      setInset(Math.max(0, Math.round(covered)));
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
