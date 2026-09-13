"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { getDay } from "@/data/plan";

export default function JournalTab({ dayNum, setDayNum, journal, setJournal }) {
  const [draft, setDraft] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const entry = getDay(dayNum);

  useEffect(() => {
    setDraft(journal[dayNum] || "");
  }, [dayNum, journal]);

  const save = async () => {
    const next = { ...journal, [dayNum]: draft };
    setJournal(next);
    try {
      await fetch("/api/reading-plan/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: dayNum, text: draft }),
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch {
      /* best effort */
    }
  };

  const go = (delta) => setDayNum((d) => Math.min(365, Math.max(1, d + delta)));

  const pastEntries = Object.keys(journal)
    .map(Number)
    .filter((d) => journal[d] && journal[d].trim())
    .sort((a, b) => b - a);

  return (
    <div className="px-5 pt-4 pb-6">
      <div className="flex items-center justify-between mb-3.5">
        <button onClick={() => go(-1)} disabled={dayNum <= 1} className="p-2 text-inksoft disabled:opacity-30">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-inkfaint">Journal</p>
          <p className="font-serif text-xl text-ink">Day {dayNum}</p>
        </div>
        <button onClick={() => go(1)} disabled={dayNum >= 365} className="p-2 text-inksoft disabled:opacity-30">
          <ChevronRight size={20} />
        </button>
      </div>

      {entry.type === "reading" && (
        <p className="text-sm text-inkfaint text-center -mt-1.5 mb-3.5">
          {entry.main}
          {entry.gospel ? ` + ${entry.gospel}` : ""}
        </p>
      )}

      <div className="sp-card mb-2.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          placeholder="What stood out to you today? What is God showing you?"
          rows={5}
          className="sp-textarea min-h-[110px]"
        />
        <div className="flex justify-between items-center mt-2.5">
          {savedFlash ? (
            <span className="text-sage text-xs flex items-center gap-1">
              <Check size={13} /> Saved
            </span>
          ) : (
            <span />
          )}
          <button onClick={save} className="sp-btn-sage py-2 px-4">
            Save
          </button>
        </div>
      </div>

      <p className="text-[0.6875rem] text-inkfaint mb-4">Your journal is private — only you can see it.</p>

      {pastEntries.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-wide text-inkfaint mb-2.5">Past Entries</p>
          <div className="space-y-2">
            {pastEntries.map((d) => {
              const e = getDay(d);
              return (
                <button
                  key={d}
                  onClick={() => setDayNum(d)}
                  className="sp-card text-left w-full"
                >
                  <p className="text-[0.6875rem] text-inkfaint font-semibold mb-1">
                    Day {d}
                    {e && e.main ? ` · ${e.main}` : ""}
                  </p>
                  <p className="text-sm text-ink truncate">{journal[d]}</p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
