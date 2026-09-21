"use client";

import { ChevronLeft, ChevronRight, Check, Flame, BookOpen } from "lucide-react";
import { computeStreak } from "@/lib/streak";
import { parseReference } from "@/lib/bibleRef";
import ReadingHistoryStrip from "./ReadingHistoryStrip";

export default function TodayTab({ plan, progress, setProgress, activePlanId, dayNum, setDayNum, setTab, onOpenBiblePassage }) {
  const totalDays = plan.PLAN.length;
  const entry = plan.getDay(dayNum);
  const dayProgress = progress[dayNum] || { p: false, r: false, m: false };
  const doneCount = Object.values(progress).filter((v) => v.p && v.r && v.m).length;
  const streak = computeStreak(progress);

  const toggle = async (key) => {
    const next = { ...dayProgress, [key]: !dayProgress[key], at: new Date().toISOString() };
    const updated = { ...progress, [dayNum]: next };
    setProgress(updated);
    try {
      await fetch("/api/reading-plan/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: dayNum, p: next.p, r: next.r, m: next.m, plan_id: activePlanId }),
      });
    } catch {
      /* best-effort; local state already updated for responsiveness */
    }
  };

  const go = (delta) => setDayNum((d) => Math.min(totalDays, Math.max(1, d + delta)));

  if (!entry) return null; // guards against a stale dayNum from a previously-longer plan

  return (
    <div className="px-5 pt-4 pb-6">

      <div className="flex items-center justify-between mb-5">
        <button onClick={() => go(-1)} disabled={dayNum <= 1} className="p-2 -ml-2 text-inksoft disabled:opacity-30">
          <ChevronLeft size={22} />
        </button>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-inkfaint mb-0.5">
            Week {entry.week}
          </p>
          <p className="font-serif text-2xl text-ink">Day {dayNum}</p>
        </div>
        <button onClick={() => go(1)} disabled={dayNum >= totalDays} className="p-2 -mr-2 text-inksoft disabled:opacity-30">
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="sp-card mb-4">
        {entry.type === "reading" ? (
          <>
            <button
              onClick={() => {
                const ref = parseReference(entry.main);
                if (ref && onOpenBiblePassage) onOpenBiblePassage(ref.bookAbbr, ref.startChapter);
              }}
              className="font-serif text-xl text-ink leading-snug text-left underline decoration-line decoration-1 underline-offset-4"
            >
              {entry.main}
            </button>
            {entry.gospel && (
              <button
                onClick={() => {
                  const ref = parseReference(entry.gospel);
                  if (ref && onOpenBiblePassage) onOpenBiblePassage(ref.bookAbbr, ref.startChapter);
                }}
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent bg-accent/8 rounded-full px-3 py-1"
              >
                <BookOpen size={13} /> {entry.gospel}
              </button>
            )}
          </>
        ) : (
          <p className="font-serif text-xl text-inksoft italic">{entry.label}</p>
        )}
      </div>

      {entry.type !== "catchup" && (
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            ["p", "Pray"],
            ["r", "Read"],
            ["m", "Reflect"],
          ].map(([key, label]) => {
            const isDone = !!dayProgress[key];
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`rounded-2xl border-2 py-4 flex flex-col items-center gap-1.5 transition active:scale-[0.97] ${
                  isDone ? "bg-sage border-sage text-white" : "bg-card border-line text-inksoft"
                }`}
              >
                {isDone ? (
                  <Check size={20} strokeWidth={2.5} />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-current opacity-45" />
                )}
                <span className="text-xs font-semibold">{isDone ? "Done" : label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex items-center gap-2.5 bg-accent/6 rounded-xl px-3.5 py-3">
          <Flame size={18} className="text-accent flex-shrink-0" />
          <p className="text-sm text-inksoft leading-tight">
            <span className="font-semibold text-ink">{streak}</span> day
            {streak === 1 ? "" : "s"}
            <br />
            in a row
          </p>
        </div>
        <div className="flex items-center gap-2.5 bg-sage/10 rounded-xl px-3.5 py-3">
          <Check size={18} className="text-sage flex-shrink-0" />
          <p className="text-sm text-inksoft leading-tight">
            <span className="font-semibold text-ink">{doneCount}</span> of {plan.TOTAL_READING_DAYS}
            <br />
            days done
          </p>
        </div>
      </div>

      <ReadingHistoryStrip planId={activePlanId} />
    </div>
  );
}
