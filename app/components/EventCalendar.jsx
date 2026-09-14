"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function toDateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function EventCalendar({ events, selectedDate, onSelectDate }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  const eventDatesSet = useMemo(() => new Set((events || []).map((e) => e.event_date)), [events]);

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

  return (
    <div className="sp-card mb-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => changeMonth(-1)} className="text-inkfaint p-1" aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <p className="font-serif text-base text-ink">{monthLabel}</p>
        <button onClick={() => changeMonth(1)} className="text-inkfaint p-1" aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} className="text-[0.625rem] text-inkfaint font-medium">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((d, i) => {
          if (d === null) return <div key={i} />;
          const key = toDateKey(viewMonth.year, viewMonth.month, d);
          const hasEvent = eventDatesSet.has(key);
          const isSelected = selectedDate === key;
          const isToday = key === todayKey;
          return (
            <button
              key={i}
              onClick={() => onSelectDate(isSelected ? null : key)}
              className={`relative aspect-square rounded-lg text-sm flex items-center justify-center ${
                isSelected ? "bg-accent text-white font-semibold" : isToday ? "bg-accent/10 text-ink" : "text-ink"
              }`}
            >
              {d}
              {hasEvent && !isSelected && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
