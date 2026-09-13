"use client";

import { useEffect, useState, useCallback } from "react";

function RsvpControl({ event, onRsvp, expanded, onToggleExpanded, rsvpList }) {
  const buttons = [
    { key: "yes", label: "Yes" },
    { key: "maybe", label: "Maybe" },
    { key: "no", label: "No" },
  ];
  return (
    <div className="mt-2">
      <div className="flex gap-1.5 items-center flex-wrap">
        {buttons.map((b) => (
          <button
            key={b.key}
            onClick={() => onRsvp(event.id, b.key)}
            className={event.my_rsvp === b.key ? "sp-pill-outline active" : "sp-pill-outline"}
          >
            {b.label}
          </button>
        ))}
        <span className="text-xs text-inkfaint">
          {event.rsvp_summary?.yes || 0} yes · {event.rsvp_summary?.maybe || 0} maybe · {event.rsvp_summary?.no || 0} no
        </span>
        <button onClick={() => onToggleExpanded(event.id)} className="text-xs text-accent underline">
          {expanded ? "Hide list" : "Who's coming?"}
        </button>
      </div>
      {expanded && (
        <div className="mt-2 text-sm text-inksoft space-y-0.5">
          {rsvpList === null && <span className="text-inkfaint">Loading…</span>}
          {rsvpList?.length === 0 && <span className="text-inkfaint">No responses yet.</span>}
          {rsvpList?.map((r, i) => (
            <div key={i}>
              {r.users?.display_name} — <strong className="text-ink">{r.status}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventsTab({ isAdmin }) {
  const [events, setEvents] = useState(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [rsvpLists, setRsvpLists] = useState({});

  const load = useCallback(async () => {
    const res = await fetch("/api/global/events");
    const data = await res.json();
    if (res.ok) setEvents(data.events);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rsvp = async (eventId, status) => {
    await fetch(`/api/global/events/${eventId}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
    if (expandedId === eventId) loadRsvpList(eventId);
  };

  const loadRsvpList = async (eventId) => {
    setRsvpLists((prev) => ({ ...prev, [eventId]: null }));
    const res = await fetch(`/api/global/events/${eventId}/rsvp`);
    const data = await res.json();
    if (res.ok) setRsvpLists((prev) => ({ ...prev, [eventId]: data.rsvps }));
  };

  const toggleExpanded = (eventId) => {
    if (expandedId === eventId) {
      setExpandedId(null);
    } else {
      setExpandedId(eventId);
      loadRsvpList(eventId);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/global/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, event_date: date, event_time: time, location }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setTitle("");
    setDate("");
    setTime("");
    setLocation("");
    load();
  };

  const remove = async (id) => {
    await fetch(`/api/global/events/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-4">Church Events</h2>

      {isAdmin && (
        <form onSubmit={submit} className="sp-card mb-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            required
            className="sp-input mb-2"
          />
          <div className="flex gap-2 mb-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="sp-input flex-1" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="sp-input flex-1" />
          </div>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            className="sp-input mb-2"
          />
          <button type="submit" className="sp-btn-primary">Add event</button>
          {error && <p className="text-sm mt-2 text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}

      {events === null && <p className="text-sm text-inkfaint">Loading…</p>}
      {events?.length === 0 && <p className="text-sm text-inkfaint">No upcoming events.</p>}
      <div className="space-y-2">
        {events?.map((ev) => (
          <div key={ev.id} className="sp-card">
            <h3 className="font-medium text-ink mb-1">{ev.title}</h3>
            <p className="text-sm text-inksoft">
              {new Date(ev.event_date + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              {ev.event_time && ` · ${ev.event_time}`}
            </p>
            {ev.location && <p className="text-sm text-inksoft mt-1">{ev.location}</p>}

            <RsvpControl
              event={ev}
              onRsvp={rsvp}
              expanded={expandedId === ev.id}
              onToggleExpanded={toggleExpanded}
              rsvpList={rsvpLists[ev.id]}
            />

            {isAdmin && (
              <button onClick={() => remove(ev.id)} className="text-xs text-inkfaint mt-2 underline">
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
