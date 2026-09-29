"use client";

import { useEffect, useState } from "react";
import { getSimpleMode, SIMPLE_MODE_EVENT } from "@/lib/simpleMode";

// Re-renders whenever Simple mode is switched (on this page, or in another tab
// of the app). Starts as `false` on the server and first paint, then reads the
// real value, so the page never mismatches what the server rendered.
export function useSimpleMode() {
  const [simple, setSimple] = useState(false);
  useEffect(() => {
    const sync = () => setSimple(getSimpleMode());
    sync();
    window.addEventListener(SIMPLE_MODE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SIMPLE_MODE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return simple;
}
