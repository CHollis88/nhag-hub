"use client";

const BASE_TABS = [
  { key: "news", label: "News" },
  { key: "events", label: "Events" },
  { key: "prayer", label: "Prayer" },
  { key: "roster", label: "Roster" },
];

// Shown ONLY while inside a group (Choir, a Sunday School class). Replaces
// the universal BottomNav entirely -- per the project's decision, being
// inside a sub-app shows only that sub-app's tabs. Getting back to
// News/Events/Hub/Bible means leaving the group via "Back to Hub."
//
// extraTabs lets a specific group's features bolt on more tabs without
// touching this component's own logic -- e.g. Choir adds Songs/Setlists
// on top of the same News/Events/Prayer/Roster every group gets for free.
export default function GroupBottomNav({ tab, setTab, extraTabs = [] }) {
  const tabs = [...BASE_TABS, ...extraTabs];
  return (
    <nav className="md:hidden sticky bottom-0 flex border-t border-line bg-card overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`flex-1 py-3.5 text-sm whitespace-nowrap px-2 border-t-2 ${
            tab === t.key
              ? "font-semibold text-accent border-accent"
              : "text-inkfaint border-transparent"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
