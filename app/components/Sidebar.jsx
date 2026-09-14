"use client";

import { useState } from "react";
import { Home, Book, Megaphone, CalendarDays, CalendarRange, Mic, ChevronLeft, ChevronRight } from "lucide-react";

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
];

export default function Sidebar({ tab, setTab }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <nav
      className={`hidden md:flex flex-col flex-shrink-0 bg-card border-r border-line py-4 sticky top-0 h-full overflow-y-auto transition-all ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {TABS.map(({ key, label, icon: Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            onClick={() => setTab(key)}
            title={collapsed ? label : undefined}
            className={`flex items-center gap-3 px-5 py-3 text-sm border-l-2 ${
              active ? "font-semibold text-accent border-accent bg-accent/5" : "text-inkfaint border-transparent"
            }`}
          >
            <Icon size={18} strokeWidth={active ? 2.3 : 1.8} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </button>
        );
      })}

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mt-auto flex items-center gap-3 px-5 py-3 text-xs text-inkfaint"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </nav>
  );
}
