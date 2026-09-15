"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, CalendarDays, Pencil } from "lucide-react";
import EmptyState from "./EmptyState";
import { formatTime12h } from "@/lib/formatTime";

// Fixed occurrence counts per interval -- no user-facing picker for this
// anymore, since a bare number with no context ("4") wasn't
// self-explanatory (especially with no visible label on mobile) and
// wasn't tied to any real calendar meaning (a 5-Sunday month isn't a
// special case here -- weekly recurrence is just "every 7 days", not
// "every Sunday this month"). These spans are simply long enough to
// cover a real season of recurring events without needing to be reset
// constantly, well under the 26-occurrence cap in lib/recurrence.js.
const DEFAULT_REPEAT_COUNT = { weekly: 13, biweekly: 13, monthly: 12 };

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

function EditEventControl({ event, onSave }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.event_date);
  const [time, setTime] = useState(event.event_time || "");
  const [location, setLocation] = useState(event.location || "");

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-xs text-accent underline flex items-center gap-1">
        <Pencil size={11} /> Edit
      </button>
    );
  }

  const save = async () => {
    await onSave(event.id, { title, event_date: date, event_time: time || null, location: location || null });
    setEditing(false);
  };

  return (
    <div className="sp-card mt-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="sp-input mb-2" />
      <div className="flex gap-2 mb-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sp-input flex-1" />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="sp-input flex-1" />
      </div>
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location (optional)"
        className="sp-input mb-2"
      />
      <div className="flex gap-3">
        <button onClick={save} className="sp-btn-primary py-1.5 px-3 text-sm">Save</button>
        <button onClick={() => setEditing(false)} className="text-xs text-inkfaint underline">Cancel</button>
      </div>
    </div>
  );
}

function DeleteControl({ event, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="text-xs text-inkfaint mt-2 underline">
        Delete
      </button>
    );
  }
  if (!event.recurrence_group_id) {
    return (
      <div className="flex gap-3 mt-2">
        <button onClick={() => onDelete(event.id, "single")} className="text-xs text-red-600 dark:text-red-400 underline">
          Confirm delete
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-inkfaint underline">Cancel</button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-3 mt-2">
      <button onClick={() => onDelete(event.id, "single")} className="text-xs text-red-600 dark:text-red-400 underline">
        Delete just this one
      </button>
      <button onClick={() => onDelete(event.id, "series")} className="text-xs text-red-600 dark:text-red-400 underline">
        Delete this &amp; future occurrences
      </button>
      <button onClick={() => setConfirming(false)} className="text-xs text-inkfaint underline">Cancel</button>
    </div>
  );
}

export default function EventsTab({ isAdmin }) {
  const [events, setEvents] = useState(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [repeat, setRepeat] = useState("");
  const [needsVolunteers, setNeedsVolunteers] = useState(false);
  const [allowRsvp, setAllowRsvp] = useState(true);
  const [volunteersNeeded, setVolunteersNeeded] = useState(3);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [rsvpLists, setRsvpLists] = useState({});
  const [expandedVolunteerId, setExpandedVolunteerId] = useState(null);
  const [volunteerLists, setVolunteerLists] = useState({});

  const load = useCallback(async () => {
    const res = await fetch("/api/global/events");
    const data = await res.json();
    if (res.ok) setEvents(data.events);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Tapping an already-selected status clears the RSVP entirely (back to
  // "no response"), rather than only ever letting you switch between
  // Yes/Maybe/No with no way to unselect.
  const rsvp = async (eventId, status) => {
    const current = events.find((ev) => ev.id === eventId);
    const isUnselecting = current?.my_rsvp === status;
    await fetch(`/api/global/events/${eventId}/rsvp`, {
      method: isUnselecting ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: isUnselecting ? undefined : JSON.stringify({ status }),
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

  const signUpVolunteer = async (eventId) => {
    const res = await fetch(`/api/global/events/${eventId}/volunteer`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }
    load();
    if (expandedVolunteerId === eventId) loadVolunteerList(eventId);
  };

  const cancelVolunteer = async (eventId) => {
    await fetch(`/api/global/events/${eventId}/volunteer`, { method: "DELETE" });
    load();
    if (expandedVolunteerId === eventId) loadVolunteerList(eventId);
  };

  const loadVolunteerList = async (eventId) => {
    setVolunteerLists((prev) => ({ ...prev, [eventId]: null }));
    const res = await fetch(`/api/global/events/${eventId}/volunteer`);
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
    setError("");
    const res = await fetch("/api/global/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        event_date: date,
        event_time: time,
        location,
        repeat: repeat || null,
        repeat_count: repeat ? DEFAULT_REPEAT_COUNT[repeat] : null,
        volunteers_needed: needsVolunteers ? volunteersNeeded : null,
        allow_rsvp: allowRsvp,
      }),
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
    setRepeat("");
    setNeedsVolunteers(false);
    setAllowRsvp(true);
    setShowForm(false);
    load();
  };

  const remove = async (id, scope) => {
    await fetch(`/api/global/events/${id}${scope === "series" ? "?scope=series" : ""}`, { method: "DELETE" });
    load();
  };

  const saveEdit = async (id, updates) => {
    await fetch(`/api/global/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    load();
  };

  const filtered = useMemo(() => {
    if (!events) return [];
    if (!query.trim()) return events;
    const q = query.toLowerCase();
    return events.filter(
      (ev) => ev.title.toLowerCase().includes(q) || (ev.location && ev.location.toLowerCase().includes(q))
    );
  }, [events, query]);

  // While actively searching, show every match together regardless of
  // date -- searching implies looking for something specific. Otherwise,
  // split into upcoming (shown normally) and past (collapsed, muted),
  // same pattern as the Young Adults app -- without this split, past
  // events just accumulate forever at the top of an ascending list,
  // pushing what's actually upcoming further down the page.
  const today = new Date().toISOString().slice(0, 10);
  const isSearching = query.trim().length > 0;
  const upcoming = isSearching ? filtered : filtered.filter((ev) => ev.event_date >= today);
  const past = isSearching ? [] : filtered.filter((ev) => ev.event_date < today);

  return (
    <div className="px-5 pt-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-2xl text-ink">Church Events</h2>
        {isAdmin && (
          <button onClick={() => setShowForm((s) => !s)} className="sp-btn-pill">
            {showForm ? "Cancel" : "+ Add"}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
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

          <div className="mb-2">
            <select value={repeat} onChange={(e) => setRepeat(e.target.value)} className="sp-input">
              <option value="">Doesn't repeat</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <label className="flex items-center gap-2 mb-2 text-sm text-inksoft">
            <input type="checkbox" checked={needsVolunteers} onChange={(e) => setNeedsVolunteers(e.target.checked)} />
            This event needs volunteers
          </label>
          <label className="flex items-center gap-2 mb-2 text-sm text-inksoft">
            <input type="checkbox" checked={allowRsvp} onChange={(e) => setAllowRsvp(e.target.checked)} />
            Allow RSVPs on this event
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
          {error && <p className="text-sm mt-2 text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}

      {events === null && <EmptyState icon={CalendarDays} text="Loading…" />}
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
      {events?.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-inkfaint">No Events match that search.</p>
      )}
      {events?.length > 0 && !isSearching && upcoming.length === 0 && past.length > 0 && (
        <p className="text-sm text-inkfaint mb-3">No upcoming events.</p>
      )}
      <div className="space-y-2">
        {upcoming.map((ev) => (
          <div key={ev.id} className="sp-card">
            <h3 className="font-medium text-ink mb-1">{ev.title}</h3>
            <p className="text-sm text-inksoft">
              {new Date(ev.event_date + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              {ev.event_time && ` · ${formatTime12h(ev.event_time)}`}
            </p>
            {ev.location && <p className="text-sm text-inksoft mt-1">{ev.location}</p>}

            {ev.allow_rsvp && (
              <RsvpControl
                event={ev}
                onRsvp={rsvp}
                expanded={expandedId === ev.id}
                onToggleExpanded={toggleExpanded}
                rsvpList={rsvpLists[ev.id]}
              />
            )}
            <VolunteerControl
              event={ev}
              onSignUp={signUpVolunteer}
              onCancel={cancelVolunteer}
              expanded={expandedVolunteerId === ev.id}
              onToggleExpanded={toggleVolunteerExpanded}
              volunteerList={volunteerLists[ev.id]}
            />

            <div className="flex gap-3 items-center mt-2 flex-wrap">
              {isAdmin && <EditEventControl event={ev} onSave={saveEdit} />}
              {isAdmin && <DeleteControl event={ev} onDelete={remove} />}
            </div>
          </div>
        ))}
      </div>

      {!isSearching && past.length > 0 && (
        <details className="mt-6">
          <summary className="text-sm text-inkfaint cursor-pointer">Past events ({past.length})</summary>
          <div className="space-y-2 mt-2">
            {past.map((ev) => (
              <div key={ev.id} className="bg-paper border border-linesoft rounded-xl p-3.5 opacity-70">
                <p className="font-serif text-base text-ink">{ev.title}</p>
                <p className="text-xs text-inkfaint">
                  {new Date(ev.event_date + "T00:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                  {ev.event_time && ` · ${formatTime12h(ev.event_time)}`}
                </p>
                {isAdmin && <DeleteControl event={ev} onDelete={remove} />}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
