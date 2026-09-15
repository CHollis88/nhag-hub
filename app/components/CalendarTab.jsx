"use client";

import { useEffect, useState, useCallback } from "react";
import EventCalendar from "./EventCalendar";

// A calendar's whole point is showing everything at a glance -- so unlike
// the global Events tab (deliberately church-wide only, matching News'
// same scoping), this aggregates church-wide events with every event
// from every ministry the signed-in user is actually an active member
// of. Each event is tagged with where it came from so the day-detail
// view stays clear about which is which.
export default function CalendarTab({ me }) {
  const [events, setEvents] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const load = useCallback(async () => {
    const myGroupMemberships = (me?.memberships || []).filter((m) => m.status === "active");

    const [globalRes, ...groupResults] = await Promise.all([
      fetch("/api/global/events").then((r) => r.json()),
      ...myGroupMemberships.map((m) =>
        fetch(`/api/groups/${m.group_id}/events`).then((r) => r.json())
      ),
    ]);

    const globalEvents = (globalRes.events || []).map((ev) => ({ ...ev, source: "Church-wide" }));
    const groupEvents = myGroupMemberships.flatMap((m, i) =>
      (groupResults[i]?.events || []).map((ev) => ({ ...ev, source: m.group?.name || "Ministry" }))
    );

    setEvents([...globalEvents, ...groupEvents]);
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  const dayEvents = selectedDate ? (events || []).filter((ev) => ev.event_date === selectedDate) : [];

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-4">Calendar</h2>

      {events === null && <p className="text-sm text-inkfaint">Loading…</p>}
      {events !== null && (
        <EventCalendar events={events} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
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
          <div className="space-y-2">
            {dayEvents.map((ev) => (
              <div key={`${ev.source}-${ev.id}`} className="sp-card">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[0.625rem] uppercase tracking-wide bg-accent/10 text-accent rounded-full px-2 py-0.5 font-semibold">
                    {ev.source}
                  </span>
                  <h3 className="font-medium text-ink">{ev.title}</h3>
                </div>
                {ev.event_time && <p className="text-sm text-inksoft">{ev.event_time}</p>}
                {ev.location && <p className="text-sm text-inksoft">{ev.location}</p>}
              </div>
            ))}
          </div>
        </>
      )}
      {!selectedDate && events?.length > 0 && (
        <p className="text-sm text-inkfaint text-center">Tap a date with a dot to see its events.</p>
      )}
    </div>
  );
}
