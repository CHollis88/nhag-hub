"use client";

import { useState } from "react";

const LINK_FIELDS = [
  ["lyrics_url", "Lyrics"],
  ["chords_url", "Chords"],
  ["sheet_music_url", "Sheet Music"],
  ["soprano_url", "Soprano Track"],
  ["alto_url", "Alto Track"],
  ["tenor_url", "Tenor Track"],
  ["bass_url", "Bass Track"],
  ["full_mix_url", "Full Mix Track"],
];

export default function SongForm({ initial, onCancel, onSave }) {
  const [fields, setFields] = useState({
    title: initial?.title || "",
    composer: initial?.composer || "",
    lyrics_url: initial?.lyrics_url || "",
    chords_url: initial?.chords_url || "",
    sheet_music_url: initial?.sheet_music_url || "",
    soprano_url: initial?.soprano_url || "",
    alto_url: initial?.alto_url || "",
    tenor_url: initial?.tenor_url || "",
    bass_url: initial?.bass_url || "",
    full_mix_url: initial?.full_mix_url || "",
    notes: initial?.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    if (!fields.title.trim()) return;
    setSaving(true);
    try {
      await onSave(fields);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sp-card space-y-2.5 mb-4">
      <input value={fields.title} onChange={set("title")} placeholder="Song title" className="sp-input" />
      <input value={fields.composer} onChange={set("composer")} placeholder="Composer / Artist (optional)" className="sp-input" />

      <p className="text-xs uppercase tracking-wide text-inkfaint pt-1">Links (leave blank if none)</p>
      {LINK_FIELDS.map(([key, label]) => (
        <input
          key={key}
          value={fields[key]}
          onChange={set(key)}
          placeholder={`${label} link`}
          className="sp-input"
        />
      ))}

      <textarea
        value={fields.notes}
        onChange={set("notes")}
        placeholder="Notes (optional)"
        rows={2}
        className="sp-textarea"
      />

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="sp-btn-secondary flex-1">
          Cancel
        </button>
        <button onClick={submit} disabled={saving} className="sp-btn-primary flex-1">
          {saving ? "Saving..." : initial ? "Save Changes" : "Add Song"}
        </button>
      </div>
    </div>
  );
}
