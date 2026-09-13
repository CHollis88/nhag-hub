"use client";

import { useEffect, useState, useCallback } from "react";

function RsvpControl({ event, onRsvp, expanded, onToggleExpanded, rsvpList }) {
  const buttons = [
    { key: "yes", label: "Yes" },
    { key: "maybe", label: "Maybe" },
    { key: "no", label: "No" },
  ];
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {buttons.map((b) => (
          <button
            key={b.key}
            onClick={() => onRsvp(event.id, b.key)}
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 999,
              border: event.my_rsvp === b.key ? "1px solid #16296B" : "1px solid #ccc",
              background: event.my_rsvp === b.key ? "#16296B" : "#fff",
              color: event.my_rsvp === b.key ? "#fff" : "#333",
            }}
          >
            {b.label}
          </button>
        ))}
        <span style={{ fontSize: 12, color: "#666" }}>
          {event.rsvp_summary?.yes || 0} yes · {event.rsvp_summary?.maybe || 0} maybe · {event.rsvp_summary?.no || 0} no
        </span>
        <button onClick={() => onToggleExpanded(event.id)} style={{ fontSize: 12 }}>
          {expanded ? "Hide list" : "Who's coming?"}
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          {rsvpList === null && <span style={{ color: "#666" }}>Loading…</span>}
          {rsvpList?.length === 0 && <span style={{ color: "#666" }}>No responses yet.</span>}
          {rsvpList?.map((r, i) => (
            <div key={i}>
              {r.users?.display_name} — <strong>{r.status}</strong>
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
    <div style={{ padding: 16 }}>
      <h2>Church Events</h2>

      {isAdmin && (
        <form onSubmit={submit} style={{ marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            required
            style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={{ flex: 1, padding: 8 }} />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ flex: 1, padding: 8 }} />
          </div>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
          />
          <button type="submit">Add event</button>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
        </form>
      )}

      {events === null && <p>Loading…</p>}
      {events?.length === 0 && <p style={{ color: "#666" }}>No upcoming events.</p>}
      {events?.map((ev) => (
        <div key={ev.id} style={{ background: "#fff", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <h3 style={{ margin: "0 0 4px" }}>{ev.title}</h3>
          <p style={{ margin: 0, color: "#666" }}>
            {new Date(ev.event_date + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            {ev.event_time && ` · ${ev.event_time}`}
          </p>
          {ev.location && <p style={{ margin: "4px 0 0", color: "#666" }}>{ev.location}</p>}

          <RsvpControl
            event={ev}
            onRsvp={rsvp}
            expanded={expandedId === ev.id}
            onToggleExpanded={toggleExpanded}
            rsvpList={rsvpLists[ev.id]}
          />

          {isAdmin && (
            <button onClick={() => remove(ev.id)} style={{ marginTop: 8, fontSize: 12 }}>
              Delete
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
