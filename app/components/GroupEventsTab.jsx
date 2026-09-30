"use client";

import { authorName } from "@/lib/authorName";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, List, CalendarDays, Pencil } from "lucide-react";
import EventCalendar from "./EventCalendar";
import ReplyButtons from "./ReplyButtons";
import { SkeletonList } from "./Skeleton";
import { formatTime12h } from "@/lib/formatTime";
import { todayLocal } from "@/lib/localDate";
import { requestJson } from "@/lib/request";
import { useFormDisclosure } from "./useFormDisclosure";
import { useResource } from "@/lib/useResource";
import { STALE, invalidate } from "@/lib/resourceCache";
import { useScreenState, useScrollMemory } from "@/lib/useScreenState";
import { useAction } from "./useAction";
import { useToast } from "./ToastProvider";
import EmptyState from "./EmptyState";

function ReplyThread({ groupId, eventId }) {
  const [replies, setReplies] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const run = useAction();

  const load = useCallback(async () => {
    try {
      const data = await requestJson(`/api/groups/${groupId}/events/${eventId}/replies`);
      setReplies(data.replies);
    } catch {
      setReplies((prev) => prev ?? []);
    }
  }, [groupId, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    // The reply stays in the box unless it actually posted.
    const { ok } = await run(() =>
      requestJson(`/api/groups/${groupId}/events/${eventId}/replies`, { method: "POST", body: { body: text } })
    );
    setSending(false);
    if (ok) {
      setText("");
      load();
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-linesoft">
      {replies?.map((r) => (
        <div key={r.id} className="text-sm text-inksoft mb-1.5">
          <strong className="text-ink">{authorName(r.users)}:</strong> {r.body}
        </div>
      ))}
      <form onSubmit={submit} className="flex gap-1.5 mt-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply…"
          id={`reply-input-${eventId}`}
          autoFocus
          className="sp-input text-sm py-1.5"
        />
        <button type="submit" disabled={sending || !text.trim()} aria-busy={sending || undefined} className="sp-btn-secondary text-sm py-1.5 px-3 disabled:opacity-60">
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}

// Same fixed spans as the global Events tab -- see EventsTab.jsx for the
// reasoning (no user-facing picker; a bare unlabeled number wasn't
// self-explanatory, and weekly recurrence isn't tied to a specific
// month's day-of-week count anyway).
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

function EditEventControl({ event, onSave, editing, onEdit, onClose, formRef }) {
  // v71 #36: whether this editor is open is owned by the screen, so only ONE
  // create/edit form is ever open at once (opening one closes the other).
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.event_date);
  const [time, setTime] = useState(event.event_time || "");
  const [location, setLocation] = useState(event.location || "");

  if (!editing) {
    return (
      <button onClick={(e) => onEdit(event.id, e.currentTarget)} data-return-focus={`event-edit-${event.id}`} className="text-xs text-accent underline flex items-center gap-1">
        <Pencil size={11} /> Edit
      </button>
    );
  }

  const save = async () => {
    const ok = await onSave(event.id, { title, event_date: date, event_time: time || null, location: location || null });
    if (ok) onClose();
  };

  return (
    <div ref={formRef} className="sp-card mt-2" role="group" aria-label="Edit event">
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
        <button onClick={onClose} className="text-xs text-inkfaint underline">Cancel</button>
      </div>
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
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [repeat, setRepeat] = useState("");
  const [needsVolunteers, setNeedsVolunteers] = useState(false);
  const [allowRsvp, setAllowRsvp] = useState(true);
  const [allowReplies, setAllowReplies] = useState(true);
  const [notify, setNotify] = useState(true);
  const [volunteersNeeded, setVolunteersNeeded] = useState(3);
  const [openThread, setOpenThread] = useState(null);
  const [expandedRsvpId, setExpandedRsvpId] = useState(null);
  const [rsvpLists, setRsvpLists] = useState({});
  const [expandedVolunteerId, setExpandedVolunteerId] = useState(null);
  const [volunteerLists, setVolunteerLists] = useState({});
  // v71 #43: search text and list/calendar view are remembered when you leave and return.
  const [query, setQuery] = useScreenState(`events:${groupId}:query`, "");
  // v71 #36: ONE form at a time (a new event OR editing one), "+ Add" becomes
  // "Cancel", focus lands on the first field, and returns to what opened it.
  const [editingEventId, setEditingEventId] = useState(null);
  const form = useFormDisclosure(editingEventId ?? "new");
  const showForm = form.open && !editingEventId;
  const closeForm = () => {
    setEditingEventId(null);
    form.hide();
  };
  const openNew = () => {
    setEditingEventId(null);
    form.show();
  };
  const openEdit = (id, fromElement) => {
    setEditingEventId(id);
    form.show(fromElement);
  };
  const [viewMode, setViewMode] = useScreenState(`events:${groupId}:view`, "list");
  const [selectedDate, setSelectedDate] = useState(null);

  const eventsUrl = `/api/groups/${groupId}/events`;
  const run = useAction();
  const toast = useToast();

  // v71 #42-45: through the shared cache. RSVP/volunteer changes edit the cached
  // list in place (setEvents) so the screen and cache never disagree.
  const eventsKey = `group:${groupId}:events`;
  const { data: events, error: eventsError, setData: setEvents } = useResource(
    eventsKey,
    async () => (await requestJson(eventsUrl)).events,
    { staleMs: STALE.list }
  );
  const loadFailed = Boolean(eventsError);
  const load = () => invalidate(eventsKey);
  const scrollAnchor = useScrollMemory(`events:${groupId}`, events !== null);

  // Tapping an already-selected status clears the RSVP entirely (back to
  // "no response"), rather than only ever letting you switch between
  // Yes/Maybe/No with no way to unselect.
  //
  // Optimistic update: local state (my_rsvp + rsvp_summary counts) changes
  // immediately, the previous state is captured, and if the request fails
  // it is restored AND the person is told (v71 #8) -- before, it snapped
  // back silently and looked like the tap did nothing.
  const rsvp = async (eventId, status) => {
    const current = events.find((ev) => ev.id === eventId);
    if (!current) return;
    const isUnselecting = current.my_rsvp === status;
    const newStatus = isUnselecting ? null : status;

    const previousEvents = events;
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        const summary = { ...ev.rsvp_summary };
        if (ev.my_rsvp) summary[ev.my_rsvp] = Math.max(0, (summary[ev.my_rsvp] || 0) - 1);
        if (newStatus) summary[newStatus] = (summary[newStatus] || 0) + 1;
        return { ...ev, my_rsvp: newStatus, rsvp_summary: summary };
      })
    );

    const { ok } = await run(() =>
      requestJson(`${eventsUrl}/${eventId}/rsvp`, {
        method: isUnselecting ? "DELETE" : "POST",
        body: isUnselecting ? undefined : { status },
      })
    );
    if (!ok) {
      setEvents(previousEvents);
      return;
    }

    if (expandedRsvpId === eventId) loadRsvpList(eventId);
  };

  const loadRsvpList = async (eventId) => {
    setRsvpLists((prev) => ({ ...prev, [eventId]: null }));
    try {
      const data = await requestJson(`${eventsUrl}/${eventId}/rsvp`);
      setRsvpLists((prev) => ({ ...prev, [eventId]: data.rsvps }));
    } catch (err) {
      setRsvpLists((prev) => {
        const next = { ...prev };
        delete next[eventId]; // not "Loading…" forever, and not a false "No responses yet"
        return next;
      });
      toast.error(err.message);
    }
  };

  const toggleRsvpExpanded = (eventId) => {
    if (expandedRsvpId === eventId) {
      setExpandedRsvpId(null);
    } else {
      setExpandedRsvpId(eventId);
      loadRsvpList(eventId);
    }
  };

  // The server decides whether there's still room (volunteer_signup runs
  // under a row lock, migration_034) and answers with the real count -- so
  // when someone else took the last spot a moment ago, the optimistic "you
  // signed up" is rolled back and the count corrected to what's true.
  const signUpVolunteer = async (eventId) => {
    const previousEvents = events;
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === eventId ? { ...ev, i_volunteered: true, volunteer_count: (ev.volunteer_count || 0) + 1 } : ev
      )
    );

    const { ok, error } = await run(() => requestJson(`${eventsUrl}/${eventId}/volunteer`, { method: "POST" }), {
      success: "You're signed up",
    });
    if (!ok) {
      const serverCount = error?.data?.volunteer_count;
      setEvents(
        typeof serverCount === "number"
          ? previousEvents.map((ev) =>
              ev.id === eventId ? { ...ev, volunteer_count: serverCount, i_volunteered: error.status === 409 } : ev
            )
          : previousEvents
      );
      return;
    }
    if (expandedVolunteerId === eventId) loadVolunteerList(eventId);
  };

  const cancelVolunteer = async (eventId) => {
    const previousEvents = events;
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === eventId
          ? { ...ev, i_volunteered: false, volunteer_count: Math.max(0, (ev.volunteer_count || 0) - 1) }
          : ev
      )
    );

    const { ok } = await run(() => requestJson(`${eventsUrl}/${eventId}/volunteer`, { method: "DELETE" }));
    if (!ok) {
      setEvents(previousEvents);
      return;
    }
    if (expandedVolunteerId === eventId) loadVolunteerList(eventId);
  };

  const loadVolunteerList = async (eventId) => {
    setVolunteerLists((prev) => ({ ...prev, [eventId]: null }));
    try {
      const data = await requestJson(`${eventsUrl}/${eventId}/volunteer`);
      setVolunteerLists((prev) => ({ ...prev, [eventId]: data.volunteers }));
    } catch (err) {
      setVolunteerLists((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
      toast.error(err.message);
    }
  };

  const toggleVolunteerExpanded = (eventId) => {
    if (expandedVolunteerId === eventId) {
      setExpandedVolunteerId(null);
    } else {
      setExpandedVolunteerId(eventId);
      loadVolunteerList(eventId);
    }
  };

  // The form only clears/closes on success -- on failure everything typed
  // stays put and the reason is shown.
  const submit = async (e) => {
    e.preventDefault();
    try {
      await requestJson(eventsUrl, {
        method: "POST",
        body: {
          title,
          event_date: date,
          event_time: time,
          location,
          repeat: repeat || null,
          repeat_count: repeat ? DEFAULT_REPEAT_COUNT[repeat] : null,
          volunteers_needed: needsVolunteers ? volunteersNeeded : null,
          allow_replies: allowReplies,
          allow_rsvp: allowRsvp,
          notify,
        },
      });
    } catch (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Event added");
    setTitle("");
    setDate("");
    setTime("");
    setLocation("");
    setRepeat("");
    setNeedsVolunteers(false);
    setAllowReplies(true);
    setAllowRsvp(true);
    setNotify(true);
    closeForm();
    load();
  };

  const remove = async (id, scope) => {
    const { ok } = await run(
      () => requestJson(`${eventsUrl}/${id}${scope === "series" ? "?scope=series" : ""}`, { method: "DELETE" }),
      { success: scope === "series" ? "Events deleted" : "Event deleted" }
    );
    if (ok) load();
  };

  // Returns whether it saved, so the edit form can stay open (keeping what
  // was typed) when it didn't.
  const saveEdit = async (id, updates) => {
    const { ok } = await run(() => requestJson(`${eventsUrl}/${id}`, { method: "PATCH", body: updates }), {
      success: "Saved",
    });
    if (ok) load();
    return ok;
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

  // Past/upcoming split only applies to the plain list view -- Calendar
  // mode already lets you browse any date, past included, directly by
  // picking it, so the split would just be redundant there. Same
  // reasoning as the global Events tab: without this, past events pile
  // up forever at the top of an ascending list.
  const today = todayLocal();
  const isSearching = query.trim().length > 0;
  const splitApplies = viewMode === "list" && !isSearching;
  const upcoming = splitApplies ? filtered.filter((ev) => ev.event_date >= today) : filtered;
  const past = splitApplies ? filtered.filter((ev) => ev.event_date < today) : [];

  return (
    <div className="px-5 pt-4 pb-6">
      <div ref={scrollAnchor} />
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif text-2xl text-ink">Group Events</h2>
        <div className="flex items-center gap-2">
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
          {canManage && (
            <button ref={form.triggerRef} onClick={() => (form.open ? closeForm() : openNew())} className="sp-btn-pill">
              {form.open ? "Cancel" : "+ Add"}
            </button>
          )}
        </div>
      </div>

      {viewMode === "calendar" && (
        <EventCalendar events={events || []} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      )}

      {canManage && showForm && (
        <form ref={form.formRef} onSubmit={submit} className="sp-card mb-4" aria-labelledby="new-event-heading">
          <h3 id="new-event-heading" className="font-serif text-lg text-ink mt-0 mb-3">New event</h3>
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
          <label className="flex items-center gap-2 mb-2 text-sm text-inksoft">
            <input type="checkbox" checked={allowReplies} onChange={(e) => setAllowReplies(e.target.checked)} />
            Allow replies on this event
          </label>
          <label className="flex items-center gap-2 mb-2 text-sm text-inksoft">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Notify the group
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

      {events === null && loadFailed && <EmptyState kind="error" text="Couldn't load events." onRetry={load} />}
      {events === null && !loadFailed && <SkeletonList count={3} />}
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
      {events?.length > 0 && viewMode === "list" && isSearching && filtered.length === 0 && (
        <p className="text-sm text-inkfaint">No Events match that search.</p>
      )}
      {events?.length > 0 && viewMode === "list" && !isSearching && upcoming.length === 0 && past.length > 0 && (
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
                expanded={expandedRsvpId === ev.id}
                onToggleExpanded={toggleRsvpExpanded}
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

            {ev.allow_replies && (
              <div className="flex items-center gap-1 flex-wrap mt-2">
                <ReplyButtons
                  open={openThread === ev.id}
                  onOpen={() => setOpenThread(ev.id)}
                  onHide={() => setOpenThread(null)}
                  inputId={`reply-input-${ev.id}`}
                />
              </div>
            )}

            <div className="flex gap-3 mt-2 items-center flex-wrap">
              {canManage && <EditEventControl event={ev} onSave={saveEdit} editing={editingEventId === ev.id} onEdit={openEdit} onClose={closeForm} formRef={form.formRef} />}
              {canManage && <DeleteControl event={ev} onDelete={remove} />}
            </div>

            {ev.allow_replies && openThread === ev.id && <ReplyThread groupId={groupId} eventId={ev.id} />}
          </div>
        ))}
      </div>

      {splitApplies && past.length > 0 && (
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
                {canManage && <DeleteControl event={ev} onDelete={remove} />}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
