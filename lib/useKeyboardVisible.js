"use client";

import { useEffect, useState } from "react";

// True while an on-screen keyboard is very likely open, detected by the
// visualViewport shrinking well below the window's normal layout height.
// Used to hide a sticky/fixed bottom nav bar while typing, so it doesn't
// get squeezed up alongside a compose bar (or any other bottom-pinned
// input) when the keyboard pushes both toward the middle of the screen
// together -- the "bottom nav coming up with the message bar" problem.
// Desktop browsers don't expose meaningful visualViewport shrinkage on
// focus, so this naturally stays false there.
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;

    const onResize = () => {
      // A shrink of more than ~120px from the full window height is a
      // reasonable signal that a keyboard, not just a minor browser-UI
      // change (address bar collapsing, etc.), is now showing.
      setVisible(window.innerHeight - vv.height > 120);
    };

    vv.addEventListener("resize", onResize);
    onResize();
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  return visible;
}
