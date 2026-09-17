"use client";

import { useEffect, useState } from "react";

const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "tel", "url", "password", "number"]);

function isTextEntry(el) {
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return TEXT_INPUT_TYPES.has(type);
  }
  return false;
}

// True while a text field anywhere in the app has focus. Used to hide
// the bottom nav bar so it doesn't compete with an on-screen keyboard
// for the same strip of screen.
//
// Driven by focus/blur (via event delegation on document), not a
// viewport-resize guess -- that heuristic (comparing visualViewport's
// height to a threshold) turned out unreliable in practice: it depends
// on the keyboard's open animation actually firing a resize event of a
// certain size within a certain time, which doesn't hold consistently
// across devices. Focus/blur is instant and deterministic: it fires the
// moment a field gains or loses focus, every time, on every browser.
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onFocusIn = (e) => {
      if (isTextEntry(e.target)) setVisible(true);
    };
    const onFocusOut = (e) => {
      if (isTextEntry(e.target)) setVisible(false);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return visible;
}
