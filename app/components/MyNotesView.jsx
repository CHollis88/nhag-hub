"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, StickyNote, Tag, X } from "lucide-react";
import { ABBR_TO_NAME } from "@/lib/bibleRef";
import { api } from "@/lib/api";
import { tagColorClass } from "@/lib/tagColor";
import EmptyState from "./EmptyState";

const HIGHLIGHT_COLORS = [
  { id: "yellow", swatch: "#F5D547" },
  { id: "green", swatch: "#8FC79A" },
  { id: "blue", swatch: "#8FB8DE" },
  { id: "pink", swatch: "#E8A6C1" },
  { id: "purple", swatch: "#B39DDB" },
  { id: "orange", swatch: "#F0A868" },
  { id: "teal", swatch: "#7EC8C0" },
];

export default function MyNotesView({ deviceId, onOpenPassage }) {
  const [notes, setNotes] = useState(null);
  const [highlights, setHighlights] = useState(null);
  const [tags, setTags] = useState(null);
  const [query, setQuery] = useState("");
  const [colorFilter, setColorFilter] = useState(null); // null = all colors
  const [tagFilter, setTagFilter] = useState(null); // null = all tags

  useEffect(() => {
    if (!deviceId) return;
    api.getNotes(deviceId).then((d) => setNotes(d.notes || []));
    api.getHighlights(deviceId).then((d) => setHighlights(d.highlights || []));
    api.getTags(deviceId).then((d) => setTags(d.tags || []));
  }, [deviceId]);

  // Merge notes, highlights, and tags into one entry per exact range, so a
  // range with any combination of the three shows as a single card. Items
  // with different exact ranges (even if they overlap) show separately --
  // that's the same exact-match rule used while reading.
  const merged = useMemo(() => {
    if (!notes || !highlights || !tags) return [];
    const byRange = {};
    const keyOf = (book, chapter, verseStart, verseEnd) => `${book}-${chapter}-${verseStart}-${verseEnd}`;
    const ensure = (book, chapter, verseStart, verseEnd, sortAt) => {
      const key = keyOf(book, chapter, verseStart, verseEnd);
      if (!byRange[key]) {
        byRange[key] = { book, chapter, verseStart, verseEnd, text: "", colors: [], tags: [], sortAt };
      }
      return byRange[key];
    };

    for (const n of notes) {
      const entry = ensure(n.book, n.chapter, n.verse_start, n.verse_end, n.updated_at);
      entry.text = n.text;
    }
    for (const h of highlights) {
      const entry = ensure(h.book, h.chapter, h.verse_start, h.verse_end, h.created_at);
      if (!entry.colors.includes(h.color)) entry.colors.push(h.color);
      if (h.created_at > entry.sortAt) entry.sortAt = h.created_at;
    }
    for (const t of tags) {
      const entry = ensure(t.book, t.chapter, t.verse_start, t.verse_end, t.created_at);
      if (!entry.tags.includes(t.tag)) entry.tags.push(t.tag);
      if (t.created_at > entry.sortAt) entry.sortAt = t.created_at;
    }

    return Object.values(byRange).sort((a, b) => (a.sortAt < b.sortAt ? 1 : -1));
  }, [notes, highlights, tags]);

  const uniqueTags = useMemo(() => {
    if (!tags) return [];
    return [...new Set(tags.map((t) => t.tag))].sort();
  }, [tags]);

  const filtered = useMemo(() => {
    let list = merged;
    if (colorFilter) {
      list = list.filter((e) => e.colors.includes(colorFilter));
    }
    if (tagFilter) {
      list = list.filter((e) => e.tags.includes(tagFilter));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const refName = (ABBR_TO_NAME[e.book] || e.book).toLowerCase();
        const range = e.verseStart === e.verseEnd ? `${e.verseStart}` : `${e.verseStart}-${e.verseEnd}`;
        const ref = `${refName} ${e.chapter}:${range}`;
        return e.text.toLowerCase().includes(q) || ref.includes(q);
      });
    }
    return list;
  }, [merged, colorFilter, tagFilter, query]);

  if (notes === null || highlights === null || tags === null) return null;

  const isEmpty = notes.length === 0 && highlights.length === 0 && tags.length === 0;

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-xl text-ink mb-4">My Notes & Highlights</h2>

      {isEmpty ? (
        <EmptyState
          icon={StickyNote}
          text="You haven't written any notes, highlighted, or tagged anything yet. Add one while reading a passage."
        />
      ) : (
        <>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your notes…"
              className="sp-input text-sm pl-9 pr-9"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-inkfaint"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button
              onClick={() => {
                setColorFilter(null);
                setTagFilter(null);
              }}
              className={`text-xs font-semibold rounded-full px-3 py-1.5 ${
                colorFilter === null && tagFilter === null
                  ? "bg-accent text-white"
                  : "bg-paper text-inkfaint border border-line"
              }`}
            >
              All
            </button>
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => setColorFilter(colorFilter === c.id ? null : c.id)}
                className={`w-7 h-7 rounded-full border-2 ${
                  colorFilter === c.id ? "border-ink" : "border-line"
                }`}
                style={{ backgroundColor: c.swatch }}
                aria-label={`Filter by ${c.id} highlights`}
              />
            ))}
          </div>

          {uniqueTags.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {uniqueTags.map((t) => {
                const isActive = tagFilter === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTagFilter(isActive ? null : t)}
                    className={`flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 ${tagColorClass(
                      t,
                      isActive ? "solid" : ""
                    )}`}
                  >
                    <Tag size={12} /> {t}
                  </button>
                );
              })}
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState icon={Search} text="Nothing matches that filter." />
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => (
                <button
                  key={`${e.book}-${e.chapter}-${e.verseStart}-${e.verseEnd}`}
                  onClick={() => onOpenPassage(e.book, e.chapter)}
                  className="w-full sp-card text-left"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-accent">
                      {ABBR_TO_NAME[e.book] || e.book} {e.chapter}:
                      {e.verseStart === e.verseEnd ? e.verseStart : `${e.verseStart}-${e.verseEnd}`}
                    </p>
                    {e.colors.length > 0 && (
                      <div className="flex gap-1">
                        {e.colors.map((c) => (
                          <span
                            key={c}
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: HIGHLIGHT_COLORS.find((h) => h.id === c)?.swatch }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  {e.text && <p className="text-sm text-ink leading-relaxed line-clamp-3 mb-1.5">{e.text}</p>}
                  {e.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {e.tags.map((t) => (
                        <span
                          key={t}
                          className={`text-[0.6875rem] font-medium rounded-full px-2 py-0.5 ${tagColorClass(t)}`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
