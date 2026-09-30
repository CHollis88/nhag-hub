"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

// v71 #31 -- the link boxes are grouped and collapsible:
//   Documents       Lyrics, Chords, Sheet music
//   Practice tracks Soprano, Alto, Tenor, Bass
//   Other audio     Split track, Demo
// Each header shows how many links are filled in ("· 2 added"), so a song that
// already has links tells you so without opening anything. Every box has a real
// label (not just a placeholder that vanishes as you type) and is a URL field:
// a link has to be a full https:// address, and one that isn't is flagged
// before saving instead of being stored and then failing to open later.
// Used for both a choir's songs and a program's songs (Programs reuses SongsTab).
const GROUPS = [
  { id: "documents", title: "Documents", fields: [["lyrics_url", "Lyrics"], ["chords_url", "Chords"], ["sheet_music_url", "Sheet music"]] },
  { id: "practice", title: "Practice tracks", fields: [["soprano_url", "Soprano"], ["alto_url", "Alto"], ["tenor_url", "Tenor"], ["bass_url", "Bass"]] },
  { id: "other", title: "Other audio", fields: [["split_track_url", "Split track"], ["demo_url", "Demo"]] },
];
const LINK_KEYS = GROUPS.flatMap((g) => g.fields.map(([key]) => key));

export function isValidLink(value) {
  const v = (value || "").trim();
  if (!v) return true; // blank is fine -- links are optional
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export default function SongForm({ initial, onCancel, onSave, formRef }) {
  const [fields, setFields] = useState(() => ({
    title: initial?.title || "",
    composer: initial?.composer || "",
    notes: initial?.notes || "",
    ...Object.fromEntries(LINK_KEYS.map((k) => [k, initial?.[k] || ""])),
  }));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [openGroups, setOpenGroups] = useState({}); // all start collapsed
  const [focusKey, setFocusKey] = useState(null);

  const set = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }));
  const showError = (key) => (touched[key] || submitAttempted) && !isValidLink(fields[key]);
  const addedCount = (group) => group.fields.filter(([key]) => fields[key].trim()).length;

  // After an invalid save attempt the offending group has been opened; once
  // its input exists, move focus to the first bad one.
  useEffect(() => {
    if (!focusKey) return;
    document.getElementById(`song-${focusKey}`)?.focus();
    setFocusKey(null);
  }, [focusKey, openGroups]);

  const submit = async () => {
    if (!fields.title.trim() || saving) return;
    const invalid = LINK_KEYS.filter((k) => !isValidLink(fields[k]));
    if (invalid.length) {
      setSubmitAttempted(true);
      setOpenGroups((o) => {
        const next = { ...o };
        for (const g of GROUPS) if (g.fields.some(([k]) => invalid.includes(k))) next[g.id] = true;
        return next;
      });
      setFocusKey(invalid[0]);
      return;
    }
    setSaving(true);
    setFailed(false);
    try {
      // Whitespace around a pasted link is trimmed. onSave reports { ok } (and
      // toasts the reason); on failure this form stays exactly as it is.
      const trimmed = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, LINK_KEYS.includes(k) || k === "title" ? v.trim() : v]));
      const result = await onSave(trimmed);
      if (result && result.ok === false) setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={formRef} className="sp-card space-y-3 mb-4" role="group" aria-labelledby="song-form-heading">
      <h3 id="song-form-heading" className="font-serif text-lg text-ink mt-0 mb-0">
        {initial ? "Edit song" : "New song"}
      </h3>

      <div>
        <label htmlFor="song-title" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">
          Song title
        </label>
        <input id="song-title" value={fields.title} onChange={set("title")} aria-required="true" className="sp-input" />
      </div>
      <div>
        <label htmlFor="song-composer" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">
          Composer / artist <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <input id="song-composer" value={fields.composer} onChange={set("composer")} className="sp-input" />
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-inkfaint mb-1">Links</p>
        <p className="text-xs text-inkfaint mt-0 mb-2">Paste the share link for each file you have. Leave the rest empty.</p>
        <div className="space-y-2">
          {GROUPS.map((group) => {
            const open = Boolean(openGroups[group.id]);
            const count = addedCount(group);
            const panelId = `song-group-${group.id}`;
            return (
              <div key={group.id} className="border border-line rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenGroups((o) => ({ ...o, [group.id]: !o[group.id] }))}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="w-full flex items-center justify-between gap-2 px-3 min-h-[44px] text-left bg-paper/50"
                >
                  <span className="text-sm text-ink">
                    {group.title}
                    {count > 0 && <span className="text-inkfaint"> · {count} added</span>}
                  </span>
                  {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                </button>
                {open && (
                  <div id={panelId} className="px-3 pb-3 pt-1 space-y-2.5">
                    {group.fields.map(([key, label]) => (
                      <div key={key}>
                        <label htmlFor={`song-${key}`} className="block text-xs text-inksoft mb-1">
                          {label}
                        </label>
                        <input
                          id={`song-${key}`}
                          type="url"
                          inputMode="url"
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          value={fields[key]}
                          onChange={set(key)}
                          onBlur={() => setTouched((t) => ({ ...t, [key]: true }))}
                          placeholder="https://"
                          aria-invalid={showError(key) ? true : undefined}
                          aria-describedby={showError(key) ? `song-${key}-error` : undefined}
                          className="sp-input"
                        />
                        {showError(key) && (
                          <p id={`song-${key}-error`} role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1 mb-0">
                            That isn't a full link. Paste the whole address, starting with https://
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="song-notes" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">
          Notes <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <textarea id="song-notes" value={fields.notes} onChange={set("notes")} rows={2} className="sp-textarea" />
      </div>

      {failed && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          Couldn&apos;t save. Your changes are still here — try again.
        </p>
      )}

      <div className="flex gap-2 pt-1 justify-end">
        <button type="button" onClick={onCancel} className="sp-btn-secondary sp-btn-compact">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || !fields.title.trim()}
          aria-busy={saving || undefined}
          className="sp-btn-primary sp-btn-compact disabled:opacity-60"
        >
          {saving ? "Saving…" : initial ? "Save Changes" : "Add Song"}
        </button>
      </div>
    </div>
  );
}
