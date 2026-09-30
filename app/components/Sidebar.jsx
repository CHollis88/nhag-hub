"use client";

import { useState } from "react";
import { Home, Book, Megaphone, CalendarDays, CalendarRange, Mic, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useSimpleMode } from "@/lib/useSimpleMode";
import { visibleTabs } from "@/lib/simpleMode";

// Desktop counterpart to BottomNav -- same tabs, same order, just a
// persistent left sidebar instead of a bottom bar once there's enough
// screen width to spare. Hidden below the md breakpoint; BottomNav is
// hidden at and above it, so exactly one of the two is ever visible.
// Shows icon + label by default; collapses to icon-only to save space,
// remembering the choice for next time.
const TABS = [
  { key: "hub", label: "Home", icon: Home },
  { key: "bible", label: "Bible", icon: Book },
  { key: "news", label: "News", icon: Megaphone },
  { key: "events", label: "Events", icon: CalendarDays },
  { key: "calendar", label: "Calendar", icon: CalendarRange },
  { key: "sermons", label: "Sermons", icon: Mic },
  { key: "directory", label: "Directory", icon: Users },
];

export default function Sidebar({ tab, setTab, badges = {} }) {
  const [collapsed, setCollapsed] = useState(false);
  const simple = useSimpleMode();

  return (
    <nav
      aria-label="Main"
      className={`hidden md:flex flex-col flex-shrink-0 bg-card border-r border-line py-4 sticky top-0 h-full overflow-y-auto transition-all ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {visibleTabs(TABS, tab, simple).map(({ key, label, icon: Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            onClick={() => setTab(key)}
            title={collapsed ? label : undefined}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 px-5 ${simple ? "py-4 text-base" : "py-3 text-sm"} border-l-2 ${
              active ? "font-semibold text-accent border-accent bg-accent/5" : "text-inkfaint border-transparent"
            }`}
          >
            <span className="relative flex-shrink-0">
              <Icon size={simple ? 22 : 18} strokeWidth={active ? 2.3 : 1.8} />
              {badges[key] && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent border border-card" />
              )}
            </span>
            {!collapsed && <span>{label}</span>}
          </button>
        );
      })}

      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand navigation" : undefined}
        className="mt-auto flex items-center gap-3 px-5 min-h-[44px] text-xs text-inkfaint hover:text-ink hover:bg-line/30 active:bg-line/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </nav>
  );
}
