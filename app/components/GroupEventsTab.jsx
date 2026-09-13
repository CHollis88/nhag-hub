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
    <div className="mt-3 pt-3 border-t border-linesoft">
      {replies?.map((r) => (
        <div key={r.id} className="text-sm text-inksoft mb-1.5">
          <strong className="text-ink">{r.users?.display_name}:</strong> {r.body}
        </div>
      ))}
      <form onSubmit={submit} className="flex gap-1.5 mt-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply…"
          className="sp-input text-sm py-1.5"
        />
        <button type="submit" className="sp-btn-secondary text-sm py-1.5 px-3">Send</button>
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
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-4">Group Events</h2>

      {canManage && (
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
              groupId={groupId}
              event={ev}
              onRsvp={rsvp}
              expanded={expandedRsvpId === ev.id}
              onToggleExpanded={toggleRsvpExpanded}
              rsvpList={rsvpLists[ev.id]}
            />

            <div className="flex gap-3 mt-2">
              <button onClick={() => setOpenThread(openThread === ev.id ? null : ev.id)} className="text-xs text-accent underline">
                {openThread === ev.id ? "Hide replies" : "Replies"}
              </button>
              {canManage && (
                <button onClick={() => remove(ev.id)} className="text-xs text-inkfaint underline">
                  Delete
                </button>
              )}
            </div>

            {openThread === ev.id && <ReplyThread groupId={groupId} eventId={ev.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
