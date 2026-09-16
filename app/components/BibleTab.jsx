"use client";

import { useState } from "react";
import PassageReader from "./PassageReader";
import ConcordanceSearch from "./ConcordanceSearch";
import MyNotesView from "./MyNotesView";
import GlossaryView from "./GlossaryView";
import TabTransition from "./TabTransition";

const MODES = [
  { id: "read", label: "Read" },
  { id: "concordance", label: "Concordance" },
  { id: "glossary", label: "Glossary" },
  { id: "notes", label: "My Notes" },
];

export default function BibleTab({ target, deviceId }) {
  const [mode, setMode] = useState("read");
  const [readTarget, setReadTarget] = useState(() => {
    if (target) return target;
    if (typeof window === "undefined") return null;
    const savedBook = localStorage.getItem("sp_bible_last_book");
    const savedChapter = localStorage.getItem("sp_bible_last_chapter");
    if (savedBook && savedChapter) {
      return { bookAbbr: savedBook, startChapter: parseInt(savedChapter, 10) };
    }
    return null;
  });

  const openPassage = (bookAbbr, chapter) => {
    setReadTarget({ bookAbbr, startChapter: chapter });
    setMode("read");
  };

  return (
    <div>
      <div className="px-5 pt-4 flex gap-2 flex-wrap">
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`text-xs font-semibold rounded-full px-3.5 py-1.5 ${
              mode === id ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <TabTransition tabKey={mode}>
        {mode === "read" && (
          <PassageReader
            initialBook={readTarget?.bookAbbr}
            initialChapter={readTarget?.startChapter}
            deviceId={deviceId}
          />
        )}
        {mode === "concordance" && <ConcordanceSearch />}
        {mode === "glossary" && <GlossaryView />}
        {mode === "notes" && <MyNotesView deviceId={deviceId} onOpenPassage={openPassage} />}
      </TabTransition>
    </div>
  );
}
