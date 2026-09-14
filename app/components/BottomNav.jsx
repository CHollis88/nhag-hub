"use client";

import { Home, Book, Megaphone, CalendarDays, CalendarRange, Mic } from "lucide-react";

// The universal bottom nav. Icon-first, matching the Young Adults app's
// own bottom nav pattern -- a small label underneath each icon, not a
// full-width text button.
export const TABS = [
  { key: "hub", label: "Home", icon: Home },
  { key: "bible", label: "Bible", icon: Book },
  { key: "news", label: "News", icon: Megaphone },
  { key: "events", label: "Events", icon: CalendarDays },
  { key: "calendar", label: "Calendar", icon: CalendarRange },
  { key: "sermons", label: "Sermons", icon: Mic },
];

export default function BottomNav({ tab, setTab }) {
  return (
    <nav className="md:hidden sticky bottom-0 z-30 bg-card border-t border-line px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <div className="max-w-lg mx-auto flex justify-between">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 flex flex-col items-center gap-1 py-1.5"
            >
              <Icon size={19} strokeWidth={active ? 2.3 : 1.8} className={active ? "text-accent" : "text-inkfaint"} />
              <span className={`text-[0.625rem] font-medium ${active ? "text-accent" : "text-inkfaint"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
