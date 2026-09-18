"use client";

import { useState } from "react";
import { Megaphone, CalendarDays, Heart, Users, ChevronLeft, ChevronRight } from "lucide-react";

export const BASE_TABS = [
  { key: "news", label: "News", icon: Megaphone },
  { key: "events", label: "Events", icon: CalendarDays },
  { key: "prayer", label: "Prayer", icon: Heart },
];

export const ROSTER_TAB = { key: "roster", label: "Roster", icon: Users };

// Desktop counterpart to GroupBottomNav -- same tabs (including any
// feature-specific extras), just a collapsible sidebar instead of a
// bottom bar once there's screen width to spare. prependTabs lead the
// nav (e.g. Today/Plan/Journal); appendTabs follow the shared set but
// come before Roster (e.g. Songs/Setlists for Choir). Roster is always
// last.
export default function GroupSidebar({ tab, setTab, prependTabs = [], appendTabs = [], badges = {} }) {
  const [collapsed, setCollapsed] = useState(false);
  const tabs = [...prependTabs, ...BASE_TABS, ...appendTabs, ROSTER_TAB];

  return (
    <nav
      className={`hidden md:flex flex-col flex-shrink-0 bg-card border-r border-line py-4 sticky top-0 h-full overflow-y-auto transition-all ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {tabs.map(({ key, label, icon: Icon }) => {
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
            <span className="relative flex-shrink-0">
              {Icon && <Icon size={18} strokeWidth={active ? 2.3 : 1.8} />}
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
        className="mt-auto flex items-center gap-3 px-5 py-3 text-xs text-inkfaint"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </nav>
  );
}
