"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, List, CalendarDays } from "lucide-react";
import EventCalendar from "./EventCalendar";

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

function VolunteerControl({ event, onSignUp, onCancel, expanded, onToggleExpanded, volunteerList }) {
  if (!event.volunteers_needed) return null;
  const full = event.volunteer_count >= event.volunteers_needed;
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-inkfaint">
          {event.volunteer_count}/{event.volunteers_needed} volunteers
        </span>
        {event.i_volunteered ? (
          <button onClick={() => onCancel(event.id)} className="sp-pill-outline active">Signed up ✓</button>
        ) : full ? (
          <span className="text-xs text-inkfaint">Full</span>
        ) : (
          <button onClick={() => onSignUp(event.id)} className="sp-pill-outline">Sign up to help</button>
        )}
        {event.volunteer_count > 0 && (
          <button onClick={() => onToggleExpanded(event.id)} className="text-xs text-accent underline">
            {expanded ? "Hide list" : "Who's signed up?"}
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-2 text-sm text-inksoft space-y-0.5">
          {volunteerList === null && <span className="text-inkfaint">Loading…</span>}
          {volunteerList?.length === 0 && <span className="text-inkfaint">No one yet.</span>}
          {volunteerList?.map((v, i) => (
            <div key={i}>{v.users?.display_name}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeleteControl({ event, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="text-xs text-inkfaint underline">
        Delete
      </button>
    );
  }
  if (!event.recurrence_group_id) {
    return (
      <span className="flex gap-3">
        <button onClick={() => onDelete(event.id, "single")} className="text-xs text-red-600 dark:text-red-400 underline">
          Confirm delete
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-inkfaint underline">Cancel</button>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-3">
      <button onClick={() => onDelete(event.id, "single")} className="text-xs text-red-600 dark:text-red-400 underline">
        Delete just this one
      </button>
      <button onClick={() => onDelete(event.id, "series")} className="text-xs text-red-600 dark:text-red-400 underline">
        Delete this &amp; future
      </button>
      <button onClick={() => setConfirming(false)} className="text-xs text-inkfaint underline">Cancel</button>
    </span>
  );
}

export default function GroupEventsTab({ groupId, canManage }) {
  const [events, setEvents] = useState(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [repeat, setRepeat] = useState("");
  const [repeatCount, setRepeatCount] = useState(4);
  const [needsVolunteers, setNeedsVolunteers] = useState(false);
  const [volunteersNeeded, setVolunteersNeeded] = useState(3);
  const [openThread, setOpenThread] = useState(null);
  const [expandedRsvpId, setExpandedRsvpId] = useState(null);
  const [rsvpLists, setRsvpLists] = useState({});
  const [expandedVolunteerId, setExpandedVolunteerId] = useState(null);
  const [volunteerLists, setVolunteerLists] = useState({});
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [selectedDate, setSelectedDate] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/events`);
    const data = await res.json();
    if (res.ok) setEvents(data.events);
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  // Tapping an already-selected status clears the RSVP entirely (back to
  // "no response"), rather than only ever letting you switch between
  // Yes/Maybe/No with no way to unselect.
  const rsvp = async (eventId, status) => {
    const current = events.find((ev) => ev.id === eventId);
    const isUnselecting = current?.my_rsvp === status;
    await fetch(`/api/groups/${groupId}/events/${eventId}/rsvp`, {
      method: isUnselecting ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: isUnselecting ? undefined : JSON.stringify({ status }),
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

  const signUpVolunteer = async (eventId) => {
    const res = await fetch(`/api/groups/${groupId}/events/${eventId}/volunteer`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }
    load();
    if (expandedVolunteerId === eventId) loadVolunteerList(eventId);
  };

  const cancelVolunteer = async (eventId) => {
    await fetch(`/api/groups/${groupId}/events/${eventId}/volunteer`, { method: "DELETE" });
    load();
    if (expandedVolunteerId === eventId) loadVolunteerList(eventId);
  };

  const loadVolunteerList = async (eventId) => {
    setVolunteerLists((prev) => ({ ...prev, [eventId]: null }));
    const res = await fetch(`/api/groups/${groupId}/events/${eventId}/volunteer`);
    const data = await res.json();
    if (res.ok) setVolunteerLists((prev) => ({ ...prev, [eventId]: data.volunteers }));
  };

  const toggleVolunteerExpanded = (eventId) => {
    if (expandedVolunteerId === eventId) {
      setExpandedVolunteerId(null);
    } else {
      setExpandedVolunteerId(eventId);
      loadVolunteerList(eventId);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/groups/${groupId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        event_date: date,
        event_time: time,
        location,
        repeat: repeat || null,
        repeat_count: repeat ? repeatCount : null,
        volunteers_needed: needsVolunteers ? volunteersNeeded : null,
      }),
    });
    if (res.ok) {
      setTitle("");
      setDate("");
      setTime("");
      setLocation("");
      setRepeat("");
      setNeedsVolunteers(false);
      load();
    }
  };

  const remove = async (id, scope) => {
    await fetch(`/api/groups/${groupId}/events/${id}${scope === "series" ? "?scope=series" : ""}`, { method: "DELETE" });
    load();
  };

  const filtered = useMemo(() => {
    if (!events) return [];
    let result = events;
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (ev) => ev.title.toLowerCase().includes(q) || (ev.location && ev.location.toLowerCase().includes(q))
      );
    }
    if (viewMode === "calendar" && selectedDate) {
      result = result.filter((ev) => ev.event_date === selectedDate);
    }
    return result;
  }, [events, query, viewMode, selectedDate]);

  return (
    <div className="px-5 pt-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-2xl text-ink">Group Events</h2>
        <div className="flex bg-paper rounded-lg p-0.5 border border-line">
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md ${viewMode === "list" ? "bg-card text-accent" : "text-inkfaint"}`}
            aria-label="List view"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`p-1.5 rounded-md ${viewMode === "calendar" ? "bg-card text-accent" : "text-inkfaint"}`}
            aria-label="Calendar view"
          >
            <CalendarDays size={16} />
          </button>
        </div>
      </div>

      {viewMode === "calendar" && (
        <EventCalendar events={events || []} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      )}

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

          <div className="flex gap-2 mb-2">
            <select value={repeat} onChange={(e) => setRepeat(e.target.value)} className="sp-input flex-1">
              <option value="">Doesn't repeat</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>
            {repeat && (
              <input
                type="number"
                min="2"
                max="26"
                value={repeatCount}
                onChange={(e) => setRepeatCount(e.target.value)}
                className="sp-input w-24"
                title="Number of occurrences"
              />
            )}
          </div>

          <label className="flex items-center gap-2 mb-2 text-sm text-inksoft">
            <input type="checkbox" checked={needsVolunteers} onChange={(e) => setNeedsVolunteers(e.target.checked)} />
            This event needs volunteers
          </label>
          {needsVolunteers && (
            <input
              type="number"
              min="1"
              value={volunteersNeeded}
              onChange={(e) => setVolunteersNeeded(e.target.value)}
              placeholder="How many volunteers?"
              className="sp-input mb-2 w-32"
            />
          )}

          <button type="submit" className="sp-btn-primary">Add event</button>
        </form>
      )}

      {events === null && <p className="text-sm text-inkfaint">Loading…</p>}
      {events !== null && (
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Events..."
            className="sp-input pl-9"
          />
        </div>
      )}
      {events?.length === 0 && <p className="text-sm text-inkfaint">No upcoming events.</p>}
      {events?.length > 0 && filtered.length === 0 && viewMode === "calendar" && (
        <p className="text-sm text-inkfaint">
          {selectedDate ? "No events on that date." : "Tap a date with a dot to see its events."}
        </p>
      )}
      {events?.length > 0 && filtered.length === 0 && viewMode === "list" && (
        <p className="text-sm text-inkfaint">No Events match that search.</p>
      )}
      <div className="space-y-2">
        {filtered.map((ev) => (
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
              expanded={expandedRsvpId === ev.id}
              onToggleExpanded={toggleRsvpExpanded}
              rsvpList={rsvpLists[ev.id]}
            />
            <VolunteerControl
              event={ev}
              onSignUp={signUpVolunteer}
              onCancel={cancelVolunteer}
              expanded={expandedVolunteerId === ev.id}
              onToggleExpanded={toggleVolunteerExpanded}
              volunteerList={volunteerLists[ev.id]}
            />

            <div className="flex gap-3 mt-2 items-center flex-wrap">
              <button onClick={() => setOpenThread(openThread === ev.id ? null : ev.id)} className="text-xs text-accent underline">
                {openThread === ev.id ? "Hide replies" : "Replies"}
              </button>
              {canManage && <DeleteControl event={ev} onDelete={remove} />}
            </div>

            {openThread === ev.id && <ReplyThread groupId={groupId} eventId={ev.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
