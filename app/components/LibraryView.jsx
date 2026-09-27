"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, BookMarked, FileText, Languages, Lightbulb, Search, Table2, ScrollText } from "lucide-react";
import { api } from "@/lib/api";
import { BOOKS, ABBR_TO_NAME } from "@/lib/bibleRef";
import ConcordanceSearch from "./ConcordanceSearch";
import GlossaryView from "./GlossaryView";
import RichContent, { TyndaleAttribution } from "./RichContent";
import TabTransition from "./TabTransition";

// The Bible tab's reference shelf. Replaces the old flat pill row
// (Concordance, Glossary, ...) that kept growing every time a source was
// added: everything that isn't reading, your own notes, or search now
// lives here, grouped by what kind of help it is.

const SECTIONS = [
  {
    id: "intros",
    icon: BookOpen,
    title: "Book Introductions",
    blurb: "Background, setting, and themes for all 66 books",
  },
  {
    id: "themes",
    icon: Lightbulb,
    title: "Theme Notes",
    blurb: "Short essays on the big ideas in each passage",
  },
  {
    id: "articles",
    icon: FileText,
    title: "Articles",
    blurb: "In-depth pieces on people, practices, and ideas",
  },
  {
    id: "charts",
    icon: Table2,
    title: "Charts",
    blurb: "Feasts, weights and measures, timelines, and more",
  },
  {
    id: "dictionaries",
    icon: BookMarked,
    title: "Dictionaries & Concordance",
    blurb: "Six Bible dictionaries and Torrey's topics",
  },
  {
    id: "languages",
    icon: Languages,
    title: "Original Languages",
    blurb: "Find the Hebrew and Greek behind any English word",
  },
  {
    id: "glossary",
    icon: ScrollText,
    title: "Glossary & What We Believe",
    blurb: "Church terms and the Assemblies of God Fundamental Truths",
  },
];

const OT_COUNT = 39;

function parseRef(ref) {
  const m = /^(\w+)\s+(\d+):(\d+)/.exec(ref || "");
  return m ? { book: m[1], chapter: parseInt(m[2], 10), verse: parseInt(m[3], 10) } : null;
}

function rangeLabel(r) {
  if (!r) return "";
  const name = ABBR_TO_NAME[r.book] || r.book;
  if (r.c1 === r.c2) return `${name} ${r.c1}:${r.v1}${r.v2 !== r.v1 ? `–${r.v2}` : ""}`;
  return `${name} ${r.c1}:${r.v1}–${r.c2}:${r.v2}`;
}

function BackBar({ label, onBack }) {
  return (
    <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-medium text-inkfaint mb-4 hover:text-ink">
      <ArrowLeft size={14} />
      {label}
    </button>
  );
}

function FilterInput({ value, onChange, placeholder }) {
  return (
    <div className="relative mb-4">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="sp-input text-sm w-full pl-8"
      />
    </div>
  );
}

// ── Item detail ──────────────────────────────────────────────────────
function ItemDetail({ collection, id, onBack, backLabel, onOpenRef }) {
  const [item, setItem] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    setItem(null);
    setError(false);
    api
      .getLibraryItem(collection, id)
      .then((d) => live && setItem(d.item))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [collection, id]);

  return (
    <div>
      <BackBar label={backLabel} onBack={onBack} />
      {error && <p className="text-sm text-accent">Couldn&apos;t load this. Check your connection and try again.</p>}
      {!item && !error && <p className="text-sm text-inkfaint">Loading...</p>}
      {item && (
        <article>
          <h3 className="font-serif text-2xl text-ink mb-3 leading-tight">{item.title}</h3>

          {collection === "intros" && (
            <button
              onClick={() => onOpenRef(`${item.id} 1:1`)}
              className="text-xs font-semibold rounded-full px-3.5 py-1.5 bg-accent text-white mb-4"
            >
              Start reading {item.title}
            </button>
          )}

          {collection === "intros" && item.summary?.length > 0 && (
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 mb-5 pb-5 border-b border-linesoft">
              {item.summary.map((s) => (
                <div key={s.label} className="contents">
                  <dt className="text-xs font-semibold text-accent pt-0.5">{s.label}</dt>
                  <dd className="text-sm text-inksoft leading-snug">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {collection === "themes" && item.ref && (
            <button
              onClick={() => onOpenRef(`${item.ref.book} ${item.ref.c1}:${item.ref.v1}`)}
              className="text-xs font-medium rounded-full px-3 py-1.5 bg-accent/8 text-accent mb-4"
            >
              Read {rangeLabel(item.ref)}
            </button>
          )}

          <RichContent blocks={item.blocks} onRef={onOpenRef} />
          <TyndaleAttribution
            source={collection === "articles" || collection === "charts" ? "Tyndale Open Bible Dictionary" : "Tyndale Open Study Notes"}
          />
        </article>
      )}
    </div>
  );
}

// ── Collection lists ─────────────────────────────────────────────────
function BookIntroList({ onPick }) {
  const groups = [
    { label: "Old Testament", books: BOOKS.slice(0, OT_COUNT) },
    { label: "New Testament", books: BOOKS.slice(OT_COUNT) },
  ];
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="text-xs text-inkfaint mb-2">{g.label}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {g.books.map(([abbr, name]) => (
              <button
                key={abbr}
                onClick={() => onPick(abbr)}
                className="text-left text-sm text-ink rounded-lg px-3 py-2 bg-paper border border-linesoft hover:border-accent/40"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TitledList({ collection, onPick, placeholder, showRefs = false }) {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .getLibraryIndex(collection)
      .then((d) => setItems(d.items || []))
      .catch(() => setError(true));
  }, [collection]);

  const shown = useMemo(() => {
    if (!items) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) => it.title.toLowerCase().includes(q) || (showRefs && rangeLabel(it.ref).toLowerCase().includes(q))
    );
  }, [items, filter, showRefs]);

  if (error) return <p className="text-sm text-accent">Couldn&apos;t load this list. Try again in a moment.</p>;
  if (!items) return <p className="text-sm text-inkfaint">Loading...</p>;

  return (
    <div>
      <FilterInput value={filter} onChange={setFilter} placeholder={placeholder} />
      {shown.length === 0 && <p className="text-sm text-inkfaint">Nothing matches &ldquo;{filter}&rdquo;.</p>}
      <div className="divide-y divide-linesoft">
        {shown.map((it) => (
          <button key={it.id} onClick={() => onPick(it.id)} className="w-full text-left py-2.5 flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink">{it.title}</span>
            {showRefs && it.ref && <span className="text-xs text-inkfaint flex-shrink-0">{rangeLabel(it.ref)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────
export default function LibraryView({ onOpenPassage }) {
  const [section, setSection] = useState(null);
  const [itemId, setItemId] = useState(null);

  const current = SECTIONS.find((s) => s.id === section);

  const openRef = (ref) => {
    const r = parseRef(ref);
    if (r) onOpenPassage(r.book, r.chapter, r.verse);
  };

  const goHome = () => {
    setSection(null);
    setItemId(null);
  };

  let body;
  if (!section) {
    body = (
      <div>
        <h2 className="font-serif text-xl text-ink mb-1">Library</h2>
        <p className="text-sm text-inkfaint mb-5">Study helps for any passage, in any translation.</p>
        <div className="space-y-2">
          {SECTIONS.map(({ id, icon: Icon, title, blurb }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className="w-full flex items-center gap-3.5 text-left rounded-xl px-4 py-3.5 bg-card border border-line hover:border-accent/40"
            >
              <span className="w-9 h-9 rounded-lg bg-accent/8 text-accent flex items-center justify-center flex-shrink-0">
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{title}</span>
                <span className="block text-xs text-inkfaint leading-snug">{blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  } else if (itemId) {
    body = (
      <ItemDetail
        collection={section}
        id={itemId}
        backLabel={current.title}
        onBack={() => setItemId(null)}
        onOpenRef={openRef}
      />
    );
  } else if (section === "dictionaries") {
    body = (
      <div>
        <div className="px-5 pt-4 -mb-2">
          <BackBar label="Library" onBack={goHome} />
        </div>
        <ConcordanceSearch title="Dictionaries & Concordance" scope="dictionaries" />
      </div>
    );
  } else if (section === "languages") {
    body = (
      <div>
        <div className="px-5 pt-4 -mb-2">
          <BackBar label="Library" onBack={goHome} />
        </div>
        <ConcordanceSearch title="Original Languages" scope="languages" initialBrowseSource="strongs-greek" />
      </div>
    );
  } else if (section === "glossary") {
    body = (
      <div>
        <div className="px-5 pt-4 -mb-2">
          <BackBar label="Library" onBack={goHome} />
        </div>
        <GlossaryView />
      </div>
    );
  } else {
    body = (
      <div>
        <BackBar label="Library" onBack={goHome} />
        <h2 className="font-serif text-xl text-ink mb-4">{current.title}</h2>
        {section === "intros" && <BookIntroList onPick={setItemId} />}
        {section === "themes" && (
          <TitledList collection="themes" onPick={setItemId} placeholder="Search themes or passages" showRefs />
        )}
        {section === "articles" && <TitledList collection="articles" onPick={setItemId} placeholder="Search articles" />}
        {section === "charts" && <TitledList collection="charts" onPick={setItemId} placeholder="Search charts" />}
      </div>
    );
  }

  // ConcordanceSearch and GlossaryView bring their own padding.
  const selfPadded = section === "dictionaries" || section === "languages" || section === "glossary";

  return (
    <TabTransition tabKey={`${section || "home"}:${itemId || ""}`}>
      <div className={selfPadded ? "" : "px-5 pt-4 pb-6"}>{body}</div>
    </TabTransition>
  );
}
