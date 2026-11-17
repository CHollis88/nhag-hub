"use client";

import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { ABBR_TO_NAME, parseQuickReference } from "@/lib/bibleRef";
import { TRANSLATIONS, DEFAULT_TRANSLATION, getTranslation } from "@/lib/bibleTranslations";

const TRANSLATION_PREF = "sp_bible_translation";

// One search box across the Bible text (any translation), the user's own notes and
// tags, and the dictionary/glossary sources -- distinct from My Notes'
// own search (which only covers the user's personal content) and from
// Concordance (word/Strong's lookup only). This is the "search
// everything" catch-all.
export default function BibleSearchView({ onOpenPassage }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState("");
  // Searches whichever translation you read in; the pills switch it.
  const [searchIn, setSearchIn] = useState(DEFAULT_TRANSLATION);
  useEffect(() => {
    try {
      const t = localStorage.getItem(TRANSLATION_PREF);
      if (t && getTranslation(t)) setSearchIn(t);
    } catch {}
  }, []);
  // Only the newest search may fill the screen (switching translation
  // mid-search must not let the older answer land on top).
  const requestId = useRef(0);

  const search = async (e, translation = searchIn) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    const myId = ++requestId.current;
    setBusy(true);
    setError("");
    // Never leave "Searching..." up forever: give the request 20 seconds.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`/api/bible/search?q=${encodeURIComponent(q)}&translation=${translation}`, { signal: controller.signal });
      let data = null;
      try { data = await res.json(); } catch { data = null; } // a proxy/server error page isn't JSON
      if (myId !== requestId.current) return; // a newer search replaced this one
      if (res.status === 401) {
        setError("You've been signed out. Reload the app and sign in again.");
      } else if (!res.ok || !data) {
        setError(data?.error || "Search didn't work just now. Please try again.");
      } else {
        setResults(data);
        setSearched(q);
      }
    } catch (err) {
      if (myId !== requestId.current) return;
      setError(
        err?.name === "AbortError"
          ? "That took too long. Please try again."
          : "Couldn't reach the server. Check your connection and try again."
      );
    } finally {
      clearTimeout(timer);
      if (myId === requestId.current) setBusy(false);
    }
  };

  // Switching translation re-runs the current search in the new one.
  const chooseTranslation = (id) => {
    if (id === searchIn) return;
    setSearchIn(id);
    setResults(null);
    if (query.trim()) search(null, id);
  };

  // Tapping a verse opens it in the translation you found it in, so the
  // words on the page match the words you tapped.
  const openVerse = (p) => {
    try {
      if (results?.searchedIn && localStorage.getItem(TRANSLATION_PREF) !== results.searchedIn) {
        localStorage.setItem(TRANSLATION_PREF, results.searchedIn);
      }
    } catch {}
    onOpenPassage?.(p.book, p.chapter, p.verse);
  };

  // "John 3:16", "1 cor 13", "genesis" -> a one-tap shortcut to open that passage.
  const jump = searched ? parseQuickReference(searched) : null;

  const dictHits = results
    ? Object.entries(results.dictionary).flatMap(([source, entries]) => entries.map((e) => ({ ...e, source })))
    : [];

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-4">Search</h2>
      <form onSubmit={search} className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
        <input
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="none"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search passages, notes, tags, words…"
          className="sp-input pl-9 pr-24"
        />
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-semibold rounded-full px-3.5 py-1.5 bg-accent text-white disabled:opacity-50"
        >
          {busy ? "…" : "Search"}
        </button>
      </form>

      <div className="flex items-center gap-1.5 mb-3 flex-wrap" role="group" aria-label="Search in">
        <span className="text-xs text-inkfaint mr-1">Search in</span>
        {TRANSLATIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={searchIn === id}
            onClick={() => chooseTranslation(id)}
            className={`text-xs rounded-full px-3 py-1 border ${searchIn === id ? "bg-accent text-white border-accent" : "text-inksoft border-line"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {busy && <p className="text-sm text-inkfaint">Searching…</p>}
      {error && !busy && (
        <p className="text-sm text-red-700 mb-3" role="alert">
          {error}
        </p>
      )}

      {results && !busy && (
        <div className="space-y-5">
          {jump && (
            <button
              onClick={() => onOpenPassage?.(jump.bookAbbr, jump.chapter, jump.verse ?? undefined)}
              className="sp-card text-left block w-full border-accent"
            >
              <p className="text-xs uppercase tracking-wide text-inkfaint mb-0.5">Open passage</p>
              <p className="text-sm font-semibold text-accent">
                {jump.bookName} {jump.chapter}
                {jump.verse ? `:${jump.verse}` : ""}
              </p>
            </button>
          )}

          {results.passagesError && (
            <p className="text-sm text-red-700" role="alert">
              Couldn't search the {getTranslation(results.searchedIn)?.label || "Bible"} text: {results.passagesError}
            </p>
          )}

          {results.passages?.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">
                Passages · {getTranslation(results.searchedIn)?.label}
              </p>
              {results.passagesTotal > results.passages.length && (
                <p className="text-xs text-inkfaint mb-2">
                  Showing the first {results.passages.length} of {results.passagesTotal.toLocaleString()} verses. Add a word to narrow it down.
                </p>
              )}
              <div className="space-y-1.5">
                {results.passages.map((p, i) => (
                  <button
                    key={`${p.book}-${p.chapter}-${p.verse}-${i}`}
                    onClick={() => openVerse(p)}
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

          {!jump && !results.passagesError && !results.passages?.length && !results.notes?.length && !results.tags?.length && !dictHits.length && (
            <p className="text-sm text-inkfaint">
              No matches found in the {getTranslation(results.searchedIn)?.label}. Try fewer or simpler words, another
              translation, or a reference like John 3:16.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
