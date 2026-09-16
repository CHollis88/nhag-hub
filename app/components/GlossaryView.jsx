"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, Cross, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import EmptyState from "./EmptyState";
import TabTransition from "./TabTransition";

function BeliefItem({ number, title, body }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-line rounded-xl overflow-hidden bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left gap-3"
      >
        <span className="text-sm font-medium text-ink">
          <span className="text-accent font-semibold mr-1.5">{number}.</span>
          {title}
        </span>
        <ChevronDown
          size={16}
          className={`text-inkfaint flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-3.5 border-t border-linesoft pt-3">
          {body.split("\n\n").map((para, i) => (
            <p key={i} className="text-sm text-inksoft leading-relaxed whitespace-pre-line mb-2.5 last:mb-0">
              {para}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function WhatWeBelieveContent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getBeliefs().then(setData);
  }, []);

  if (!data) return null;

  return (
    <div>
      <p className="text-sm text-inksoft leading-relaxed mb-5">{data.intro}</p>
      <div className="space-y-2 mb-5">
        {data.truths.map((t) => (
          <BeliefItem key={t.number} number={t.number} title={t.title} body={t.body} />
        ))}
      </div>
      <p className="text-xs text-inkfaint leading-relaxed pt-4 border-t border-linesoft">{data.closing}</p>
    </div>
  );
}

export default function GlossaryView() {
  const [tab, setTab] = useState("glossary"); // "glossary" | "beliefs"
  const [entries, setEntries] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.getGlossary().then((d) => setEntries(d.entries || []));
  }, []);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) => e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q)
    );
  }, [entries, query]);

  const grouped = useMemo(() => {
    const byCategory = {};
    for (const e of filtered) {
      if (!byCategory[e.category]) byCategory[e.category] = [];
      byCategory[e.category].push(e);
    }
    return byCategory;
  }, [filtered]);

  if (entries === null) return null;

  return (
    <div className="px-5 pt-4 pb-6">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("glossary")}
          className={`flex-1 text-sm font-semibold rounded-full px-3 py-2 ${
            tab === "glossary" ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
          }`}
        >
          Glossary
        </button>
        <button
          onClick={() => setTab("beliefs")}
          className={`flex-1 text-sm font-semibold rounded-full px-3 py-2 ${
            tab === "beliefs" ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
          }`}
        >
          What We Believe
        </button>
      </div>

      <TabTransition tabKey={tab}>
        {tab === "glossary" ? (
          <>
            <p className="text-sm text-inkfaint mb-4">
              Plain-language explanations of common church and Bible terms.
            </p>

            <div className="relative mb-5">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search terms…"
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

            {filtered.length === 0 ? (
              <EmptyState icon={Search} text={`No terms match "${query}".`} />
            ) : (
              Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="mb-6">
                  <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">{category}</p>
                  <div className="space-y-2">
                    {items.map((e) => (
                      <div key={e.term} className="sp-card">
                        <p className="font-serif text-base text-ink font-semibold mb-1">{e.term}</p>
                        <p className="text-sm text-inksoft leading-relaxed">{e.definition}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}

            {!query && (
              <div className="flex items-center gap-2 text-xs text-inkfaint mt-2">
                <BookOpen size={14} />
                <span>{entries.length} terms</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Cross size={16} className="text-accent" />
              <h2 className="font-serif text-xl text-ink">What We Believe</h2>
            </div>
            <p className="text-sm text-inkfaint mb-4">
              The Assemblies of God Statement of Fundamental Truths — our official 16 doctrines.
            </p>
            <WhatWeBelieveContent />
          </>
        )}
      </TabTransition>
    </div>
  );
}
