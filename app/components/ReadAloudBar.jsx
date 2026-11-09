"use client";

import { useSyncExternalStore } from "react";
import { Play, Pause, X } from "lucide-react";
import { bibleSpeech, subscribe, getSnapshot, getServerSnapshot } from "@/lib/bibleSpeech";

// v71.25 -- the small Read Aloud bar. Mounted once for the whole app, so the
// chapter keeps being read (and stays controllable) when you leave the Bible.
export const OPEN_BIBLE_EVENT = "nhag-open-bible";

export default function ReadAloudBar() {
  const sp = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // While the Read Aloud sheet is open on the Bible screen, it has the controls.
  if (!sp.active || (sp.readerMounted && sp.sheetOpen)) return null;

  const open = () => {
    if (sp.readerMounted) bibleSpeech.requestOpenSheet();
    else window.dispatchEvent(new CustomEvent(OPEN_BIBLE_EVENT, { detail: { book: sp.book, chapter: sp.chapter } }));
  };

  return (
    <div
      className="fixed left-2 right-2 md:left-auto md:right-4 md:w-96 z-[55] bg-card border border-line rounded-2xl shadow-lg bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 flex items-center gap-2 px-3 py-2"
      role="region"
      aria-label="Read Aloud"
    >
      <button onClick={open} className="flex-1 min-w-0 text-left" aria-label="Open the chapter being read">
        <p className="m-0 text-sm font-medium text-ink truncate">
          {sp.label}
          {sp.token?.verse ? `:${sp.token.verse}` : ""}
        </p>
        <p className="m-0 text-xs text-inkfaint">{sp.paused ? "Paused" : "Reading aloud"}</p>
      </button>
      <button
        onClick={sp.paused ? bibleSpeech.resume : bibleSpeech.pause}
        className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center"
        aria-label={sp.paused ? "Resume" : "Pause"}
      >
        {sp.paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
      </button>
      <button onClick={bibleSpeech.stop} className="w-10 h-10 flex items-center justify-center text-inkfaint" aria-label="Stop reading">
        <X size={16} />
      </button>
    </div>
  );
}
