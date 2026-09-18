"use client";

import { Megaphone, CalendarDays, Heart, Users } from "lucide-react";

export const BASE_TABS = [
  { key: "news", label: "News", icon: Megaphone },
  { key: "events", label: "Events", icon: CalendarDays },
  { key: "prayer", label: "Prayer", icon: Heart },
];

export const ROSTER_TAB = { key: "roster", label: "Roster", icon: Users };

// Shown ONLY while inside a group (Choir, a Sunday School class). Replaces
// the universal BottomNav entirely -- per the project's decision, being
// inside a sub-app shows only that sub-app's tabs. Getting back to
// News/Events/Hub/Bible means leaving the group via "Back to Hub."
//
// prependTabs lead the nav (e.g. Today/Plan/Journal for a reading-plan
// group); appendTabs follow the shared set but come before Roster (e.g.
// Songs/Setlists for Choir). Roster is always last.
export default function GroupBottomNav({ tab, setTab, prependTabs = [], appendTabs = [], badges = {} }) {
  const tabs = [...prependTabs, ...BASE_TABS, ...appendTabs, ROSTER_TAB];
  return (
    <nav className="md:hidden sticky bottom-0 z-30 bg-card border-t border-line px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] overflow-x-auto">
      <div className="flex justify-between gap-1">
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 flex flex-col items-center gap-1 py-1.5 px-2 min-w-[64px]"
            >
              <span className="relative">
                {Icon && <Icon size={19} strokeWidth={active ? 2.3 : 1.8} className={active ? "text-accent" : "text-inkfaint"} />}
                {badges[key] && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent border border-card" />
                )}
              </span>
              <span className={`text-[0.625rem] font-medium whitespace-nowrap ${active ? "text-accent" : "text-inkfaint"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
