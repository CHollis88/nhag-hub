"use client";

import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { cleanOccurrences } from "@/lib/lexiconFormat";

const SOURCES = [
  { key: "easton", label: "Easton's Bible Dictionary", subtitle: "General Bible dictionary — people, places, and terms" },
  { key: "smith", label: "Smith's Bible Dictionary", subtitle: "A more detailed Bible dictionary" },
  { key: "hitchcock", label: "Hitchcock's Bible Names Dictionary", subtitle: "What Bible names mean" },
  { key: "torrey", label: "Torrey's Topical Textbook", subtitle: "Verses grouped by topic, not definitions" },
  { key: "webster", label: "Webster's 1828 Dictionary (KJV words)", subtitle: "Old English word meanings, for tricky KJV wording" },
];

const BROWSE_SOURCES = [
  { key: "easton", label: "Easton's", subtitle: "General Bible dictionary" },
  { key: "smith", label: "Smith's", subtitle: "A more detailed Bible dictionary" },
  { key: "hitchcock", label: "Hitchcock's", subtitle: "What Bible names mean" },
  { key: "torrey", label: "Torrey's", subtitle: "Verses grouped by topic" },
  { key: "webster", label: "Webster's", subtitle: "Old English word meanings" },
  { key: "strongs-hebrew", label: "Strong's Hebrew", subtitle: "Original Hebrew word meanings" },
  { key: "strongs-greek", label: "Strong's Greek", subtitle: "Original Greek word meanings" },
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function EntryCard({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = entry.rootWord || entry.occurrences || entry.twot;

  return (
    <div className="sp-card">
      <p className="font-serif text-base text-ink mb-1">
        {entry.word}
        {entry.native && <span className="text-inkfaint font-sans text-sm ml-2">{entry.native}</span>}
        {entry.id && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className={`font-sans text-xs ml-2 rounded-full px-2 py-0.5 ${
              hasMore ? "bg-accent/8 text-accent" : "text-inkfaint"
            }`}
          >
            {entry.id}
          </button>
        )}
      </p>
      {entry.partOfSpeech && (
        <p className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-1">{entry.partOfSpeech}</p>
      )}
      {entry.lines ? (
        <div className="space-y-1">
          {entry.lines.map((line, i) => (
            <p key={i} className="text-sm text-inksoft leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      ) : (
        entry.text && <p className="text-sm text-inksoft leading-relaxed">{entry.text}</p>
      )}
      {expanded && hasMore && (
        <div className="mt-2.5 pt-2.5 border-t border-linesoft space-y-1.5">
          {entry.rootWord && (
            <p className="text-xs text-inkfaint">
              <span className="font-semibold">Root:</span> {entry.rootWord}
            </p>
          )}
          {entry.twot && (
            <p className="text-xs text-inkfaint">
              <span className="font-semibold">TWOT / TDNT Reference:</span> {entry.twot}
            </p>
          )}
          {entry.occurrences && (
            <p className="text-xs text-inkfaint">
              <span className="font-semibold">Translated as:</span> {cleanOccurrences(entry.occurrences)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BrowseTab() {
  const [source, setSource] = useState("easton");
  const [letter, setLetter] = useState("A");
  const [entries, setEntries] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async (src, ltr) => {
    setLoading(true);
    const d = await api.browseDictionary(src, ltr);
    setEntries(d.entries);
    setLoading(false);
  };

  const chooseSource = (src) => {
    setSource(src);
    load(src, letter);
  };
  const chooseLetter = (ltr) => {
    setLetter(ltr);
    load(source, ltr);
  };

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Choose a dictionary</p>
      <div className="flex flex-wrap gap-2 mb-2">
        {BROWSE_SOURCES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => chooseSource(key)}
            className={`text-xs font-medium rounded-full px-3 py-1.5 ${
              source === key ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-[0.6875rem] text-inkfaint mb-4">
        {BROWSE_SOURCES.find((s) => s.key === source)?.subtitle}
      </p>

      <select value={letter} onChange={(e) => chooseLetter(e.target.value)} className="sp-input text-sm mb-4">
        {ALPHABET.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>

      {loading && <p className="text-sm text-inkfaint">Loading...</p>}
      {entries && entries.length === 0 && !loading && (
        <p className="text-sm text-inkfaint">No entries starting with "{letter}".</p>
      )}
      {entries && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e) => (
            <EntryCard key={e.id || e.word} entry={e} />
          ))}
        </div>
      )}
      {entries && entries.length === 200 && (
        <p className="text-xs text-inkfaint mt-2">Showing the first 200 entries for this letter.</p>
      )}
    </div>
  );
}

function SearchTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [strongsResult, setStrongsResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // The input itself updates instantly on every keystroke (state below),
  // but the actual network request is debounced -- typing "faith" used to
  // fire 5 separate fetches (one per letter), which is wasted server load
  // and causes visible flicker as each response lands out of order. This
  // waits 300ms after the person stops typing before searching, and a
  // request-id guard (latestRequestId) makes sure that if an older,
  // slower request somehow resolves after a newer one, it's ignored
  // rather than overwriting fresher results with stale ones.
  const latestRequestId = useRef(0);

  useEffect(() => {
    const q = query;
    if (!q.trim()) {
      setResults(null);
      setStrongsResult(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const requestId = ++latestRequestId.current;

    const t = setTimeout(async () => {
      setStrongsResult(null);

      if (/^[GH]\d+$/i.test(q.trim())) {
        try {
          const d = await api.getLexiconEntry(q.trim().toUpperCase());
          if (requestId !== latestRequestId.current) return;
          setStrongsResult({ id: q.trim().toUpperCase(), entry: d.entry });
          setResults(null);
        } catch {
          if (requestId !== latestRequestId.current) return;
          setStrongsResult(null);
        }
      } else {
        const d = await api.searchDictionary(q);
        if (requestId !== latestRequestId.current) return;
        setResults(d);
      }

      if (requestId === latestRequestId.current) setLoading(false);
    }, 300);

    return () => clearTimeout(t);
  }, [query]);

  const hasAnyResults = results && SOURCES.some(({ key }) => (results[key] || []).length > 0);

  return (
    <div>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a word (e.g. 'faith') or Strong's number (e.g. G26)"
          className="sp-input pl-9"
        />
      </div>

      {loading && <p className="text-sm text-inkfaint">Searching...</p>}

      {strongsResult && (
        <div className="sp-card">
          <p className="font-serif text-lg text-ink mb-1">
            {strongsResult.entry.Hb_word || strongsResult.entry.Gk_word}
            <span className="text-sm text-inkfaint font-sans ml-2">{strongsResult.id}</span>
          </p>
          <p className="text-sm text-inkfaint italic mb-2">{strongsResult.entry.transliteration}</p>
          {strongsResult.entry.part_of_speech && (
            <p className="text-xs text-inkfaint uppercase tracking-wide mb-2">
              {strongsResult.entry.part_of_speech}
            </p>
          )}
          <p className="text-sm text-ink mb-2">{strongsResult.entry.strongs_def}</p>
          {strongsResult.entry.outline_usage && (
            <p className="text-xs text-inkfaint mb-1">
              <span className="font-semibold">Usage:</span> {strongsResult.entry.outline_usage}
            </p>
          )}
          {strongsResult.entry.root_word && (
            <p className="text-xs text-inkfaint mb-1">
              <span className="font-semibold">Root:</span> {strongsResult.entry.root_word}
            </p>
          )}
          {strongsResult.entry.occurrences && (
            <p className="text-xs text-inkfaint">
              <span className="font-semibold">Translated as:</span>{" "}
              {cleanOccurrences(strongsResult.entry.occurrences)}
            </p>
          )}
        </div>
      )}

      {results && !hasAnyResults && !strongsResult && !loading && query && (
        <p className="text-sm text-inkfaint">No entries found.</p>
      )}

      {results &&
        SOURCES.map(({ key, label, subtitle }) => {
          const items = results[key] || [];
          if (items.length === 0) return null;
          return (
            <div key={key} className="mb-5">
              <p className="text-xs uppercase tracking-wide text-inkfaint mb-0.5">{label}</p>
              <p className="text-[0.6875rem] text-inkfaint mb-2">{subtitle}</p>
              <div className="space-y-2">
                {items.map((r) => (
                  <EntryCard key={r.word} entry={r} />
                ))}
              </div>
            </div>
          );
        })}

      {!query && (
        <p className="text-sm text-inkfaint">
          Search any word or topic to look it up across Easton's, Smith's, Hitchcock's, and
          Torrey's — or enter a Strong's number directly (like G26 or H7225) to see its original
          Hebrew or Greek meaning.
        </p>
      )}
    </div>
  );
}

export default function ConcordanceSearch() {
  const [mode, setMode] = useState("search"); // "search" | "browse"

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-xl text-ink mb-4">Concordance</h2>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode("search")}
          className={`text-xs font-semibold rounded-full px-3.5 py-1.5 ${
            mode === "search" ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
          }`}
        >
          Search
        </button>
        <button
          onClick={() => setMode("browse")}
          className={`text-xs font-semibold rounded-full px-3.5 py-1.5 ${
            mode === "browse" ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
          }`}
        >
          Browse
        </button>
      </div>

      {mode === "search" ? <SearchTab /> : <BrowseTab />}
    </div>
  );
}
