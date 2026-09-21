"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { ABBR_TO_NAME } from "@/lib/bibleRef";

// One search box across the KJV text itself, the user's own notes and
// tags, and the dictionary/glossary sources -- distinct from My Notes'
// own search (which only covers the user's personal content) and from
// Concordance (word/Strong's lookup only). This is the "search
// everything" catch-all.
export default function BibleSearchView({ onOpenPassage }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  const search = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/bible/search?q=${encodeURIComponent(query.trim())}`);
    const data = await res.json();
    setBusy(false);
    if (res.ok) setResults(data);
  };

  const dictHits = results
    ? Object.entries(results.dictionary).flatMap(([source, entries]) => entries.map((e) => ({ ...e, source })))
    : [];

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-4">Search</h2>
      <form onSubmit={search} className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search passages, notes, tags, words…"
          className="sp-input pl-9"
        />
      </form>

      {busy && <p className="text-sm text-inkfaint">Searching…</p>}

      {results && !busy && (
        <div className="space-y-5">
          {results.passages?.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Passages</p>
              <div className="space-y-1.5">
                {results.passages.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => onOpenPassage?.(p.book, p.chapter)}
                    className="sp-card text-left block w-full"
                  >
                    <p className="text-xs font-semibold text-accent mb-0.5">
                      {ABBR_TO_NAME[p.book] || p.book} {p.chapter}:{p.verse}
                    </p>
                    <p className="text-sm text-inksoft">{p.text}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.notes?.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Your Notes</p>
              <div className="space-y-1.5">
                {results.notes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => onOpenPassage?.(n.book, n.chapter)}
                    className="sp-card text-left block w-full"
                  >
                    <p className="text-xs font-semibold text-accent mb-0.5">
                      {ABBR_TO_NAME[n.book] || n.book} {n.chapter}:{n.verse_start}
                      {n.verse_end !== n.verse_start ? `-${n.verse_end}` : ""}
                    </p>
                    <p className="text-sm text-inksoft">{n.text}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.tags?.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Your Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {results.tags.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onOpenPassage?.(t.book, t.chapter)}
                    className="sp-pill-outline text-xs"
                  >
                    #{t.tag} · {ABBR_TO_NAME[t.book] || t.book} {t.chapter}:{t.verse_start}
                  </button>
                ))}
              </div>
            </div>
          )}

          {dictHits.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Dictionary</p>
              <div className="space-y-1.5">
                {dictHits.slice(0, 10).map((d, i) => (
                  <div key={i} className="sp-card">
                    <p className="text-sm font-semibold text-ink">{d.word}</p>
                    <p className="text-sm text-inksoft">{d.definition || d.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!results.passages?.length && !results.notes?.length && !results.tags?.length && !dictHits.length && (
            <p className="text-sm text-inkfaint">No matches found.</p>
          )}
        </div>
      )}
    </div>
  );
}
