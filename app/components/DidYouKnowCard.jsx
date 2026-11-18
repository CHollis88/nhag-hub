"use client";

import { useEffect, useState } from "react";
import {
  Heart, Camera, BookOpen, Highlighter, Volume2, Search, Sparkles, NotebookPen, Users,
  CalendarDays, Mic, RefreshCw, SlidersHorizontal, Bell, HelpCircle, Lightbulb, X, ChevronRight,
} from "lucide-react";

// Named imports only (a "* as" import would pull every icon into the app).
const ICONS = { Heart, Camera, BookOpen, Highlighter, Volume2, Search, Sparkles, NotebookPen, Users, CalendarDays, Mic, RefreshCw, SlidersHorizontal, Bell, HelpCircle };
import { TIPS } from "@/lib/tips";

// v72 "Did you know?" on Home: ONE feature at a time, a new one every few
// days. "Show me" opens it; the X retires that tip for good. Replaces the
// old Get Started list (those tips now live in Help & FAQ too).

const RETIRED_KEY = "nhag_tips_retired";
const EVERY_DAYS = 3;

function retired() {
  try {
    return new Set(JSON.parse(localStorage.getItem(RETIRED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export default function DidYouKnowCard({ onGo }) {
  const [tip, setTip] = useState(null);
  const pick = () => {
    const r = retired();
    const left = TIPS.filter((t) => !r.has(t.id));
    if (!left.length) return setTip(null);
    const slot = Math.floor(Date.now() / (EVERY_DAYS * 86400000));
    setTip(left[slot % left.length]);
  };
  useEffect(pick, []);

  if (!tip) return null;
  const retire = () => {
    try {
      const r = retired();
      r.add(tip.id);
      localStorage.setItem(RETIRED_KEY, JSON.stringify([...r]));
    } catch {
      // ignore
    }
    setTip(null); // the next one shows next time
  };
  const Icon = ICONS[tip.icon] || Lightbulb;

  return (
    <div className="sp-card mb-4 py-3 relative" role="region" aria-label="Did you know?">
      <button type="button" onClick={retire} className="absolute top-2 right-2 p-1.5 text-inkfaint" aria-label="Got it, hide this tip">
        <X size={15} />
      </button>
      <div className="flex gap-3 pr-6">
        <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
          <Icon size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[0.6875rem] uppercase tracking-wide text-inkfaint">Did you know?</span>
          <span className="block text-sm font-semibold text-ink">{tip.title}</span>
          <span className="block text-xs text-inksoft mt-0.5">{tip.body}</span>
          {tip.go && (
            <button
              type="button"
              onClick={() => {
                retire();
                onGo?.(tip.go);
              }}
              className="mt-1.5 text-xs font-semibold text-accent flex items-center gap-0.5"
            >
              Show me <ChevronRight size={13} aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
