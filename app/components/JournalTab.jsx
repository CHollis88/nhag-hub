"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Check, Download } from "lucide-react";

export default function JournalTab({ plan, activePlanId, dayNum, setDayNum, journal, setJournal }) {
  const [draft, setDraft] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const totalDays = plan.PLAN.length;
  const entry = plan.getDay(dayNum);

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
        body: JSON.stringify({ day: dayNum, text: draft, plan_id: activePlanId }),
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch {
      /* best effort */
    }
  };

  const go = (delta) => setDayNum((d) => Math.min(totalDays, Math.max(1, d + delta)));

  const pastEntries = Object.keys(journal)
    .map(Number)
    .filter((d) => journal[d] && journal[d].trim())
    .sort((a, b) => b - a);

  // Client-side only -- no new API call needed, since every entry is
  // already loaded into the journal prop. Downloads only entries the
  // person has actually written, in a plain, readable format.
  const exportJournal = () => {
    const lines = [`My Journal — ${plan.name}`, ""];
    pastEntries
      .slice()
      .sort((a, b) => a - b)
      .forEach((d) => {
        const e = plan.getDay(d);
        lines.push(`Day ${d}${e?.main ? ` — ${e.main}` : ""}`);
        lines.push(journal[d]);
        lines.push("");
      });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `journal-${plan.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <button onClick={() => go(1)} disabled={dayNum >= totalDays} className="p-2 text-inksoft disabled:opacity-30">
          <ChevronRight size={20} />
        </button>
      </div>

      {entry?.type === "reading" && (
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

      <div className="flex items-center justify-between mb-4">
        <p className="text-[0.6875rem] text-inkfaint">Your journal is private — only you can see it.</p>
        {pastEntries.length > 0 && (
          <button onClick={exportJournal} className="text-xs text-accent underline flex items-center gap-1 flex-shrink-0">
            <Download size={12} /> Export
          </button>
        )}
      </div>

      {pastEntries.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-wide text-inkfaint mb-2.5">Past Entries</p>
          <div className="space-y-2">
            {pastEntries.map((d) => {
              const e = plan.getDay(d);
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
