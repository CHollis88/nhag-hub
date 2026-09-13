"use client";

import { useEffect, useState, useCallback } from "react";

function ReplyThread({ groupId, eventId }) {
  const [replies, setReplies] = useState(null);
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/events/${eventId}/replies`);
    const data = await res.json();
    if (res.ok) setReplies(data.replies);
  }, [groupId, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await fetch(`/api/groups/${groupId}/events/${eventId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    setText("");
    load();
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
      {replies?.map((r) => (
        <div key={r.id} style={{ fontSize: 13, marginBottom: 6 }}>
          <strong>{r.users?.display_name}:</strong> {r.body}
        </div>
      ))}
      <form onSubmit={submit} style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply…"
          style={{ flex: 1, padding: 6, fontSize: 13 }}
        />
        <button type="submit" style={{ fontSize: 13 }}>Send</button>
      </form>
    </div>
  );
}

function RsvpControl({ groupId, event, onRsvp, expanded, onToggleExpanded, rsvpList }) {
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

export default function GroupEventsTab({ groupId, canManage }) {
  const [events, setEvents] = useState(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [openThread, setOpenThread] = useState(null);
  const [expandedRsvpId, setExpandedRsvpId] = useState(null);
  const [rsvpLists, setRsvpLists] = useState({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/events`);
    const data = await res.json();
    if (res.ok) setEvents(data.events);
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const rsvp = async (eventId, status) => {
    await fetch(`/api/groups/${groupId}/events/${eventId}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
    if (expandedRsvpId === eventId) loadRsvpList(eventId);
  };

  const loadRsvpList = async (eventId) => {
    setRsvpLists((prev) => ({ ...prev, [eventId]: null }));
    const res = await fetch(`/api/groups/${groupId}/events/${eventId}/rsvp`);
    const data = await res.json();
    if (res.ok) setRsvpLists((prev) => ({ ...prev, [eventId]: data.rsvps }));
  };

  const toggleRsvpExpanded = (eventId) => {
    if (expandedRsvpId === eventId) {
      setExpandedRsvpId(null);
    } else {
      setExpandedRsvpId(eventId);
      loadRsvpList(eventId);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/groups/${groupId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, event_date: date, event_time: time, location }),
    });
    if (res.ok) {
      setTitle("");
      setDate("");
      setTime("");
      setLocation("");
      load();
    }
  };

  const remove = async (id) => {
    await fetch(`/api/groups/${groupId}/events/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Group Events</h2>

      {canManage && (
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
            groupId={groupId}
            event={ev}
            onRsvp={rsvp}
            expanded={expandedRsvpId === ev.id}
            onToggleExpanded={toggleRsvpExpanded}
            rsvpList={rsvpLists[ev.id]}
          />

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button onClick={() => setOpenThread(openThread === ev.id ? null : ev.id)} style={{ fontSize: 12 }}>
              {openThread === ev.id ? "Hide replies" : "Replies"}
            </button>
            {canManage && (
              <button onClick={() => remove(ev.id)} style={{ fontSize: 12 }}>
                Delete
              </button>
            )}
          </div>

          {openThread === ev.id && <ReplyThread groupId={groupId} eventId={ev.id} />}
        </div>
      ))}
    </div>
  );
}
