"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { CalendarRange } from "lucide-react";
import EventCalendar from "./EventCalendar";
import EmptyState from "./EmptyState";
import { readableTextColor } from "@/lib/colorContrast";
import { formatTime12h } from "@/lib/formatTime";

const DEFAULT_TILE_COLOR = "#4A5568";
const CHURCH_WIDE_COLOR = "#16296B"; // the app's own brand navy, distinct from any ministry's tile color

// A calendar's whole point is showing everything at a glance -- so unlike
// the global Events tab (deliberately church-wide only, matching News'
// same scoping), this aggregates church-wide events with every event
// from every ministry the signed-in user is actually an active member
// of, color-coded by that ministry's own tile color, with a toggle to
// show/hide each source -- same pattern as Canvas's academic calendar.
export default function CalendarTab({ me }) {
  const [rawEvents, setRawEvents] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [hiddenSources, setHiddenSources] = useState(new Set());

  const myGroups = (me?.memberships || []).filter((m) => m.status === "active");

  const sources = useMemo(
    () => [
      { id: "global", name: "Church-wide", color: CHURCH_WIDE_COLOR },
      ...myGroups.map((m) => ({
        id: m.group_id,
        name: m.group?.name || "Ministry",
        color: m.group?.tile_color || DEFAULT_TILE_COLOR,
      })),
    ],
    [me]
  );

  const load = useCallback(async () => {
    const [globalRes, ...groupResults] = await Promise.all([
      fetch("/api/global/events").then((r) => r.json()),
      ...myGroups.map((m) => fetch(`/api/groups/${m.group_id}/events`).then((r) => r.json())),
    ]);

    const globalEvents = (globalRes.events || []).map((ev) => ({
      ...ev,
      sourceId: "global",
      sourceName: "Church-wide",
      color: CHURCH_WIDE_COLOR,
    }));
    const groupEvents = myGroups.flatMap((m, i) =>
      (groupResults[i]?.events || []).map((ev) => ({
        ...ev,
        sourceId: m.group_id,
        sourceName: m.group?.name || "Ministry",
        color: m.group?.tile_color || DEFAULT_TILE_COLOR,
      }))
    );

    setRawEvents([...globalEvents, ...groupEvents]);
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSource = (id) => {
    setHiddenSources((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const visibleEvents = (rawEvents || []).filter((ev) => !hiddenSources.has(ev.sourceId));

  const dayEvents = selectedDate
    ? visibleEvents
        .filter((ev) => ev.event_date === selectedDate)
        .sort((a, b) => (a.event_time || "99:99").localeCompare(b.event_time || "99:99"))
    : [];

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-3">Calendar</h2>

      {sources.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {sources.map((s) => {
            const hidden = hiddenSources.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleSource(s.id)}
                className={`inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border ${
                  hidden ? "border-line text-inkfaint" : "border-transparent"
                }`}
                style={hidden ? {} : { background: s.color, color: readableTextColor(s.color) }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: hidden ? s.color : readableTextColor(s.color) }}
                />
                {s.name}
              </button>
            );
          })}
        </div>
      )}

      {rawEvents === null && <EmptyState icon={CalendarRange} text="Loading…" />}
      {rawEvents !== null && (
        <EventCalendar events={visibleEvents} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      )}

      {selectedDate && (
        <>
          <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          {dayEvents.length === 0 && <p className="text-sm text-inkfaint">No events on this date.</p>}
          <div className="space-y-1.5">
            {dayEvents.map((ev) => (
              <div
                key={`${ev.sourceId}-${ev.id}`}
                className="flex items-center gap-3 bg-card border border-line rounded-lg pl-0 pr-3 py-2.5 overflow-hidden"
              >
                <span className="w-1.5 self-stretch flex-shrink-0" style={{ background: ev.color }} />
                <span className="text-xs text-inkfaint w-16 flex-shrink-0">
                  {ev.event_time ? formatTime12h(ev.event_time) : "All day"}
                </span>
                <span className="text-sm text-ink flex-1 truncate">{ev.title}</span>
                <span className="text-[0.625rem] text-inkfaint flex-shrink-0">{ev.sourceName}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {!selectedDate && visibleEvents.length > 0 && (
        <p className="text-sm text-inkfaint text-center">Tap a date to see its events.</p>
      )}
    </div>
  );
}
