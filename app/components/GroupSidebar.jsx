"use client";

const BASE_TABS = [
  { key: "news", label: "News" },
  { key: "events", label: "Events" },
  { key: "prayer", label: "Prayer" },
  { key: "roster", label: "Roster" },
];

// Desktop counterpart to GroupBottomNav -- same tabs (including any
// feature-specific extras like Songs/Setlists), just a sidebar instead of
// a bottom bar once there's screen width to spare.
export default function GroupSidebar({ tab, setTab, extraTabs = [] }) {
  const tabs = [...BASE_TABS, ...extraTabs];
  return (
    <nav className="hidden md:flex flex-col w-56 flex-shrink-0 bg-card border-r border-line py-4">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`text-left px-5 py-3 text-sm border-l-2 ${
            tab === t.key
              ? "font-semibold text-accent border-accent bg-accent/5"
              : "text-inkfaint border-transparent"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
