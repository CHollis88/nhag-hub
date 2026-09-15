"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import { readableTextColor } from "@/lib/colorContrast";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// events must each carry a `color` (hex) already resolved by the caller
// -- this component just renders whatever color it's given, same as
// Canvas's month view: small colored bars with a truncated title inside
// each day cell, not a generic dot. Desktop (>=768px) shows 2 bars per
// day at its current size; narrower screens show just 1, with cells a
// little shorter overall, to stay legible without losing the same
// colored-bar-with-title treatment.
export default function EventCalendar({ events, selectedDate, onSelectDate }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const [isNarrow, setIsNarrow] = useState(true); // default to the more compact mobile treatment until measured
  const [isWide, setIsWide] = useState(false); // desktop tier -- more room to actually use, not just "not narrow"

  useEffect(() => {
    const mqNarrow = window.matchMedia("(max-width: 767px)");
    const mqWide = window.matchMedia("(min-width: 1024px)");
    setIsNarrow(mqNarrow.matches);
    setIsWide(mqWide.matches);
    const narrowListener = (e) => setIsNarrow(e.matches);
    const wideListener = (e) => setIsWide(e.matches);
    mqNarrow.addEventListener("change", narrowListener);
    mqWide.addEventListener("change", wideListener);
    return () => {
      mqNarrow.removeEventListener("change", narrowListener);
      mqWide.removeEventListener("change", wideListener);
    };
  }, []);

  const maxBarsPerDay = isNarrow ? 1 : isWide ? 3 : 2;

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of events || []) {
      if (!map[ev.event_date]) map[ev.event_date] = [];
      map[ev.event_date].push(ev);
    }
    // Earliest time first within each day, same ordering as the day list below.
    for (const key in map) {
      map[key].sort((a, b) => (a.event_time || "99:99").localeCompare(b.event_time || "99:99"));
    }
    return map;
  }, [events]);

  const grid = useMemo(() => {
    const { year, month } = viewMonth;
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [viewMonth]);

  const monthLabel = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const changeMonth = (delta) => {
    setViewMonth((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const todayKey = toDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const jumpToToday = () => {
    const now = new Date();
    setViewMonth({ year: now.getFullYear(), month: now.getMonth() });
    onSelectDate(todayKey);
  };

  const isOnCurrentMonth = viewMonth.year === new Date().getFullYear() && viewMonth.month === new Date().getMonth();

  return (
    <div className="sp-card mb-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => changeMonth(-1)} className="text-inkfaint p-1" aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <p className="font-serif text-base text-ink">{monthLabel}</p>
          {!isOnCurrentMonth && (
            <button
              onClick={jumpToToday}
              className="text-inkfaint p-1"
              aria-label="Jump to today"
              title="Jump to today"
            >
              <CalendarCheck size={15} />
            </button>
          )}
        </div>
        <button onClick={() => changeMonth(1)} className="text-inkfaint p-1" aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} className="text-[0.625rem] text-inkfaint font-medium">{w.slice(0, 1)}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((d, i) => {
          if (d === null) return <div key={i} />;
          const key = toDateKey(viewMonth.year, viewMonth.month, d);
          const dayEvents = eventsByDate[key] || [];
          const isSelected = selectedDate === key;
          const isToday = key === todayKey;
          const shown = dayEvents.slice(0, maxBarsPerDay);
          const overflow = dayEvents.length - shown.length;

          return (
            <button
              key={i}
              onClick={() => onSelectDate(isSelected ? null : key)}
              className={`flex flex-col items-stretch rounded-lg p-0.5 text-left min-h-[2.75rem] md:min-h-[3.25rem] lg:min-h-[4.5rem] ${
                isSelected ? "bg-accent/15 ring-1 ring-accent" : isToday ? "bg-accent/5" : ""
              }`}
            >
              <span className={`text-[0.6875rem] md:text-xs lg:text-sm px-0.5 ${isToday ? "font-bold text-accent" : "text-ink"}`}>
                {d}
              </span>
              <div className="flex flex-col gap-0.5 mt-0.5">
                {shown.map((ev, j) => (
                  <span
                    key={j}
                    className="text-[0.625rem] lg:text-xs leading-tight rounded px-1 py-[1px] truncate"
                    style={{ background: ev.color, color: readableTextColor(ev.color) }}
                    title={ev.title}
                  >
                    {ev.title}
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="text-[0.625rem] lg:text-xs text-inkfaint px-0.5">+{overflow}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
