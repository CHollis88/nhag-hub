"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { TRANSLATIONS, DEFAULT_TRANSLATION } from "@/lib/bibleTranslations";
import { markItemDone } from "@/lib/onboarding";
import { markFeatureSeen } from "@/lib/newFeatures";
import NewPill from "./NewPill";

const PREF_KEY = "sp_bible_translation"; // the same setting the Bible reader uses

// v72: "Pick your Bible translation" -- used by the setup walkthrough,
// the checklist, and the What's-new tour. Saves exactly what choosing a
// translation inside the Bible reader saves.
export function BibleChoices({ onPicked }) {
  const [current, setCurrent] = useState(() => {
    try {
      return localStorage.getItem(PREF_KEY) || DEFAULT_TRANSLATION;
    } catch {
      return DEFAULT_TRANSLATION;
    }
  });
  const pick = (id) => {
    try {
      localStorage.setItem(PREF_KEY, id);
    } catch {
      // ignore
    }
    setCurrent(id);
    markItemDone("bible");
    if (id === "nkjv" || id === "amp") markFeatureSeen("translations");
    onPicked?.(id);
  };
  return (
    <div className="space-y-2">
      {TRANSLATIONS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => pick(t.id)}
          className={`w-full text-left rounded-xl px-4 py-3 border flex items-center gap-3 ${t.id === current ? "border-accent bg-accent/10" : "border-line bg-card"}`}
        >
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-base font-semibold text-ink">{t.label}</span>
              {(t.id === "nkjv" || t.id === "amp") && <NewPill id="translations" />}
            </span>
            <span className="block text-sm text-inksoft truncate">{t.fullName}</span>
          </span>
          {t.id === current && <Check size={20} className="text-accent flex-shrink-0" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}

export default function BiblePickerSheet({ onClose }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end md:items-center justify-center" onClick={onClose}>
      <div
        className="bg-paper w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Pick your Bible translation"
      >
        <h2 className="font-serif text-xl text-ink mb-1">Pick your Bible</h2>
        <p className="text-sm text-inksoft mb-4">This is the translation the Bible tab opens in. You can switch any time.</p>
        <BibleChoices onPicked={() => setTimeout(onClose, 250)} />
      </div>
    </div>
  );
}
