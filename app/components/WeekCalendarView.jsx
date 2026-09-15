"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import { readableTextColor } from "@/lib/colorContrast";
import { formatTime12h } from "@/lib/formatTime";

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Full-width day rows instead of a cramped grid -- on a typical phone, a
// month-grid cell only has room for about 5-6 characters before an event
// title truncates ("Choir Practice" becomes "Choir…"). A week view gives
// each day its own full-width row, so titles show in full.
export default function WeekCalendarView({ events, selectedDate, onSelectDate }) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(selectedDate ? new Date(selectedDate + "T00:00:00") : new Date())
  );

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of events || []) {
      if (!map[ev.event_date]) map[ev.event_date] = [];
      map[ev.event_date].push(ev);
    }
    for (const key in map) {
      map[key].sort((a, b) => (a.event_time || "99:99").localeCompare(b.event_time || "99:99"));
    }
    return map;
  }, [events]);

  const changeWeek = (delta) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
  };

  const jumpToToday = () => setWeekStart(startOfWeek(new Date()));

  const todayKey = toDateKey(new Date());
  const isOnCurrentWeek = toDateKey(weekStart) === toDateKey(startOfWeek(new Date()));

  const weekLabel = `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <div className="sp-card mb-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => changeWeek(-1)} className="text-inkfaint p-1" aria-label="Previous week">
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <p className="font-serif text-base text-ink">{weekLabel}</p>
          {!isOnCurrentWeek && (
            <button onClick={jumpToToday} className="text-inkfaint p-1" aria-label="Jump to this week" title="Jump to this week">
              <CalendarCheck size={15} />
            </button>
          )}
        </div>
        <button onClick={() => changeWeek(1)} className="text-inkfaint p-1" aria-label="Next week">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="space-y-1">
        {days.map((d) => {
          const key = toDateKey(d);
          const dayEvents = eventsByDate[key] || [];
          const isToday = key === todayKey;
          const isSelected = selectedDate === key;
          return (
            <div key={key} className={`rounded-lg overflow-hidden ${isSelected ? "ring-1 ring-accent" : ""}`}>
              <button
                onClick={() => onSelectDate(isSelected ? null : key)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-left ${isToday ? "bg-accent/5" : ""}`}
              >
                <span className={`text-xs w-9 flex-shrink-0 ${isToday ? "font-bold text-accent" : "text-inkfaint"}`}>
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span className={`text-sm w-6 flex-shrink-0 ${isToday ? "font-bold text-accent" : "text-ink"}`}>
                  {d.getDate()}
                </span>
                <div className="flex-1 min-w-0 space-y-0.5">
                  {dayEvents.length === 0 ? (
                    <span className="text-xs text-inkfaint">—</span>
                  ) : (
                    dayEvents.map((ev) => (
                      <div key={ev.id} className="flex items-center gap-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: ev.color }}
                        />
                        <span className="text-xs text-ink truncate">{ev.title}</span>
                        {ev.event_time && (
                          <span className="text-[0.625rem] text-inkfaint flex-shrink-0">
                            {formatTime12h(ev.event_time)}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
