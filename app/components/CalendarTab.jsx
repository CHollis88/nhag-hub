"use client";

import { useEffect, useState, useCallback } from "react";
import EventCalendar from "./EventCalendar";

export default function CalendarTab() {
  const [events, setEvents] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/global/events");
    const data = await res.json();
    if (res.ok) setEvents(data.events);
  }, []);

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
              <div key={ev.id} className="sp-card">
                <h3 className="font-medium text-ink mb-1">{ev.title}</h3>
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
