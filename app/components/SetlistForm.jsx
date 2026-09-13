"use client";

import { useMemo, useState } from "react";
import { Search, X, ChevronUp, ChevronDown, Plus } from "lucide-react";

export default function SetlistForm({ initial, allSongs, onCancel, onSave }) {
  const [serviceDate, setServiceDate] = useState(initial?.service_date || "");
  const [service, setService] = useState(initial?.service || "AM");
  const [entries, setEntries] = useState(
    initial?.songs?.map((s) => ({ song_id: s.group_songs?.id, title: s.group_songs?.title, note: s.note || "" })) || []
  );
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

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
    if (!serviceDate) return;
    setSaving(true);
    try {
      await onSave({
        service_date: serviceDate,
        service,
        songs: entries.map((e) => ({ song_id: e.song_id, note: e.note })),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sp-card space-y-3 mb-4">
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className="sp-input" />
        <select value={service} onChange={(e) => setService(e.target.value)} className="sp-input">
          <option value="AM">AM Service</option>
          <option value="PM">PM Service</option>
          <option value="CP">Choir Practice</option>
        </select>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Songs</p>
        {entries.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-1.5">
            <span className="text-xs text-inkfaint w-5 flex-shrink-0">{idx + 1}.</span>
            <span className="text-sm text-ink flex-1 truncate">{entry.title}</span>
            <input
              value={entry.note}
              onChange={(e) => updateNote(idx, e.target.value)}
              placeholder="Key / person"
              className="sp-input w-28 text-xs py-1.5"
            />
            <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-inkfaint disabled:opacity-20">
              <ChevronUp size={15} />
            </button>
            <button
              onClick={() => move(idx, 1)}
              disabled={idx === entries.length - 1}
              className="text-inkfaint disabled:opacity-20"
            >
              <ChevronDown size={15} />
            </button>
            <button onClick={() => removeEntry(idx)} className="text-inkfaint">
              <X size={15} />
            </button>
          </div>
        ))}

        <div className="relative mt-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs to add..."
            className="sp-input pl-8 text-sm"
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

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="sp-btn-secondary flex-1">
          Cancel
        </button>
        <button onClick={submit} disabled={saving} className="sp-btn-primary flex-1">
          {saving ? "Saving..." : initial ? "Save Changes" : "Post Setlist"}
        </button>
      </div>
    </div>
  );
}
