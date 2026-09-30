"use client";

import { useMemo, useState } from "react";
import { Search, X, ChevronUp, ChevronDown, Plus } from "lucide-react";

export default function SetlistForm({ initial, allSongs, onCancel, onSave, formRef }) {
  const [serviceDate, setServiceDate] = useState(initial?.service_date || "");
  const [service, setService] = useState(initial?.service || "AM");
  const [entries, setEntries] = useState(
    initial?.songs?.map((s) => ({
      song_id: s.group_songs?.id || s.program_songs?.id,
      title: s.group_songs?.title || s.program_songs?.title,
      note: s.note || "",
    })) || []
  );
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // Only meaningful for a brand-new setlist -- editing an existing one
  // doesn't trigger a fresh notification regardless, so there's
  // nothing for this to toggle in that mode.
  const [notify, setNotify] = useState(true);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allSongs
      .filter((s) => s.title.toLowerCase().includes(q))
      .filter((s) => !entries.some((e) => e.song_id === s.id))
      .slice(0, 8);
  }, [query, allSongs, entries]);

  const addSong = (song) => {
    setEntries((e) => [...e, { song_id: song.id, title: song.title, note: "" }]);
    setQuery("");
  };

  const removeEntry = (idx) => setEntries((e) => e.filter((_, i) => i !== idx));

  const move = (idx, delta) => {
    setEntries((e) => {
      const next = [...e];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return e;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const updateNote = (idx, note) =>
    setEntries((e) => e.map((entry, i) => (i === idx ? { ...entry, note } : entry)));

  const submit = async () => {
    if (!serviceDate || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      // onSave reports { ok } and shows its own toast with the reason.
      // On failure this form simply stays as it is -- every song, note and
      // date still here -- so nothing has to be re-entered.
      const result = await onSave({
        service_date: serviceDate,
        service,
        songs: entries.map((e) => ({ song_id: e.song_id, note: e.note })),
        notify,
      });
      if (result && result.ok === false) setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={formRef} className="sp-card space-y-3 mb-4" role="group" aria-labelledby="setlist-form-heading">
      <h3 id="setlist-form-heading" className="font-serif text-lg text-ink mt-0 mb-0">
        {initial ? "Edit setlist" : "New setlist"}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="setlist-date" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">Date</label>
          <input id="setlist-date" type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className="sp-input" />
        </div>
        <div>
          <label htmlFor="setlist-service" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">Service</label>
          <select id="setlist-service" value={service} onChange={(e) => setService(e.target.value)} className="sp-input">
            <option value="AM">AM Service</option>
            <option value="PM">PM Service</option>
            <option value="CP">Choir Practice</option>
          </select>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-inkfaint mb-1">Songs</p>
        <p className="text-xs text-inkfaint mb-2">
          The small box next to each song is optional — use it for the key it's sung in, who's
          leading it, or any other quick note.
        </p>
        {/* v71 #32: each song is TWO lines, so nothing is squeezed at large text sizes:
              line 1 -- number, title (wraps rather than being cut off), Remove
              line 2 -- the optional note box, then Up and Down
            and every button is a proper 44px touch target. */}
        <ol className="list-none p-0 m-0 space-y-2">
          {entries.map((entry, idx) => (
            <li key={entry.song_id} className="rounded-xl border border-linesoft bg-paper/50 px-2.5 py-2">
              <div className="flex items-start gap-2">
                <span className="text-xs text-inkfaint w-6 flex-shrink-0 pt-3">{idx + 1}.</span>
                <span className="text-sm text-ink flex-1 min-w-0 break-words pt-2.5">{entry.title}</span>
                <button
                  type="button"
                  onClick={() => removeEntry(idx)}
                  className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-inkfaint"
                  aria-label={`Remove ${entry.title}`}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center gap-1 pl-8">
                <input
                  value={entry.note}
                  onChange={(e) => updateNote(idx, e.target.value)}
                  placeholder="Key / person"
                  aria-label={`Note for ${entry.title}`}
                  className="sp-input flex-1 min-w-0 py-2"
                />
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-inkfaint disabled:opacity-20"
                  aria-label={`Move ${entry.title} up`}
                >
                  <ChevronUp size={20} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === entries.length - 1}
                  className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-inkfaint disabled:opacity-20"
                  aria-label={`Move ${entry.title} down`}
                >
                  <ChevronDown size={20} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ol>

        <div className="relative mt-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs to add..."
            className="sp-input pl-8"
          />
        </div>
        {results.length > 0 && (
          <div className="border border-line rounded-lg mt-1.5 overflow-hidden">
            {results.map((song) => (
              <button
                key={song.id}
                onClick={() => addSong(song)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm bg-card border-b border-linesoft last:border-b-0"
              >
                <Plus size={13} className="text-accent flex-shrink-0" />
                {song.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {!initial && (
        <label className="flex items-center gap-2 text-sm text-inksoft">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Notify the group
        </label>
      )}

      {failed && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          Couldn&apos;t save. Your changes are still here — fix anything flagged and try again.
        </p>
      )}

      <div className="flex gap-2 pt-1 justify-end">
        <button onClick={onCancel} className="sp-btn-secondary sp-btn-compact">
          Cancel
        </button>
        <button onClick={submit} disabled={saving || !serviceDate} aria-busy={saving || undefined} className="sp-btn-primary sp-btn-compact disabled:opacity-60">
          {saving ? "Saving…" : initial ? "Save Changes" : "Post Setlist"}
        </button>
      </div>
    </div>
  );
}
