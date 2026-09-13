"use client";

import { useEffect, useState } from "react";
import {
  Home, BookOpen, Highlighter, Volume2, Search, Sparkles,
  Megaphone, CalendarDays, Settings as SettingsIcon, X, ChevronRight,
} from "lucide-react";

const STORAGE_KEY = "sp_home_get_started_dismissed";
const DONE_KEY = "sp_home_get_started_done";

function getDone() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) || "[]");
  } catch {
    return [];
  }
}

// Covers the whole app, not just the Bible tab -- moved here from the
// Reading Plan's Today screen, where its "jump to a tab" links never
// actually worked (they were trying to control that screen's own
// Today/Plan/Journal switcher, not the real top-level tabs).
const ITEMS = [
  {
    id: "ministries",
    icon: Home,
    title: "Explore your ministries",
    body: "Tiles below show every ministry you're in — tap one to launch into its own News, Events, Prayer, and Roster.",
    tab: "hub",
  },
  {
    id: "wordstudy",
    icon: BookOpen,
    title: "Tap any underlined word in the Bible",
    body: "See its original Hebrew or Greek meaning, root word, and how it's translated elsewhere.",
    tab: "bible",
  },
  {
    id: "verseactions",
    icon: Highlighter,
    title: "Tap a verse number",
    body: "Highlight it, add a note, tag it, or see cross-references. Tap more verse numbers first to select a whole passage at once.",
    tab: "bible",
  },
  {
    id: "listen",
    icon: Volume2,
    title: "Try listening to Scripture",
    body: "Tap the speaker to hear a whole chapter read aloud, or the ear icon to hear just one word at a time.",
    tab: "bible",
  },
  {
    id: "concordance",
    icon: Search,
    title: "Search the Concordance",
    body: "Look up any word or topic across all your dictionaries at once, or browse one from A to Z.",
    tab: "bible",
  },
  {
    id: "glossary",
    icon: Sparkles,
    title: "New here? Read the Glossary",
    body: "Plain-language explanations of terms like grace, salvation, and baptism — plus what we believe as a church.",
    tab: "bible",
  },
  {
    id: "news",
    icon: Megaphone,
    title: "Catch up on Church News",
    body: "Announcements and messages from the pastor, church-wide.",
    tab: "news",
  },
  {
    id: "events",
    icon: CalendarDays,
    title: "See what's coming up",
    body: "Church-wide events — tap Yes, Maybe, or No to RSVP.",
    tab: "events",
  },
  {
    id: "settings",
    icon: SettingsIcon,
    title: "Set your PIN and notifications",
    body: "Open Settings (gear icon, top right) to set a PIN for quick sign-in and choose what you get notified about.",
    action: "settings",
  },
];

export default function HomeGetStartedCard({ onGoToTab, onOpenSettings }) {
  const [dismissed, setDismissed] = useState(null); // null = not yet checked
  const [done, setDone] = useState([]);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    setDone(getDone());
  }, []);

  const markDone = (id) => {
    const next = [...new Set([...done, id])];
    setDone(next);
    localStorage.setItem(DONE_KEY, JSON.stringify(next));
  };

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  if (dismissed === null || dismissed) return null;

  const remaining = ITEMS.filter((item) => !done.includes(item.id));
  if (remaining.length === 0) return null;

  const activate = (item) => {
    markDone(item.id);
    if (item.action === "settings") onOpenSettings?.();
    else if (item.tab) onGoToTab(item.tab);
  };

  return (
    <div className="sp-card mb-5 border-accent/20">
      <div className="flex items-center justify-between mb-3">
        <p className="font-serif text-lg text-ink">Get Started</p>
        <button onClick={dismiss} className="text-inkfaint" aria-label="Dismiss Get Started">
          <X size={18} />
        </button>
      </div>
      <div className="space-y-2">
        {remaining.map((item) => (
          <button
            key={item.id}
            onClick={() => activate(item)}
            className="w-full flex items-center gap-3 text-left bg-paper rounded-xl px-3.5 py-3"
          >
            <div className="w-9 h-9 rounded-full bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
              <item.icon size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              <p className="text-xs text-inkfaint leading-snug">{item.body}</p>
            </div>
            <ChevronRight size={16} className="text-inkfaint flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
