"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { todayLocal, tzOffsetMinutes } from "@/lib/localDate";
import { requestJson } from "@/lib/request";

// A 30-day picture of actual daily reading, driven by
// /api/reading-plan/dashboard -- a compact complement to the streak/done-count
// cards already in TodayTab, using calendar dates (not plan day numbers) so it
// reflects real daily activity even if someone is ahead of or behind their plan.
//
// v71 #37 made it readable by everyone:
//   * a plain-words summary first ("12 of the last 30 days");
//   * every day is its own labelled cell -- the day number is printed on it
//     and a screen reader hears "Mon, May 4: read" -- instead of 30 unlabelled
//     colour bars that only had hover tooltips;
//   * a day that was read carries a CHECK MARK as well as a fill, so it doesn't
//     depend on telling two colours apart;
//   * 10 cells per row (3 rows) so each cell stays a comfortable size on a
//     narrow phone, and grows with the text-size setting.
function dayLabel(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function ReadingHistoryStrip({ planId }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const d = await requestJson(`/api/reading-plan/dashboard?plan_id=${planId}&today=${todayLocal()}&tz_offset=${tzOffsetMinutes()}`);
      setData(d);
    } catch {
      setFailed(true);
    }
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  if (failed) {
    return (
      <p className="mt-3 text-xs text-inkfaint" role="status">
        Couldn't load your reading history.{" "}
        <button onClick={load} className="underline">
          Try again
        </button>
      </p>
    );
  }
  if (!data || !Array.isArray(data.history)) return null;

  const days = data.history;
  const readCount = days.filter((d) => d.completed).length;
  const today = todayLocal();

  return (
    <div className="mt-3">
      <p className="text-sm text-ink mb-0.5 font-medium">
        {readCount} of the last {days.length} days
      </p>
      <p className="text-xs text-inkfaint mb-2">
        You've read {data.percent_complete}% of the plan. A <span aria-hidden="true">✓</span>
        <span className="sr-only">check mark</span> means you read that day.
      </p>
      <ol className="grid grid-cols-10 gap-1 list-none p-0 m-0" aria-label={`Reading history, last ${days.length} days`}>
        {days.map((d) => {
          const isToday = d.date === today;
          return (
            <li
              key={d.date}
              aria-label={`${dayLabel(d.date)}${isToday ? " (today)" : ""}: ${d.completed ? "read" : "not read"}`}
              className={`relative aspect-square min-w-0 rounded-md flex flex-col items-center justify-center leading-none text-[0.625rem]
                ${d.completed ? "bg-sage text-white font-semibold" : "bg-paper border border-line text-inkfaint"}
                ${isToday ? "ring-2 ring-accent ring-offset-1" : ""}`}
            >
              <span aria-hidden="true">{Number(d.date.slice(8, 10))}</span>
              {d.completed && <Check size={10} strokeWidth={3} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
