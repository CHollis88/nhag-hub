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
// extraTabs lets a specific group type bolt on more tabs without touching
// this component's own logic -- e.g. Choir adds Songs/Setlists on top of
// the same News/Events/Prayer/Roster every group gets for free.
export default function GroupBottomNav({ tab, setTab, extraTabs = [] }) {
  const tabs = [...BASE_TABS, ...extraTabs];
  return (
    <nav
      style={{
        position: "sticky",
        bottom: 0,
        display: "flex",
        borderTop: "1px solid #ddd",
        background: "#fff",
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          style={{
            flex: 1,
            padding: "14px 0",
            border: "none",
            background: "none",
            fontSize: 14,
            fontWeight: tab === t.key ? 700 : 400,
            color: tab === t.key ? "#16296B" : "#888",
            borderTop: tab === t.key ? "2px solid #16296B" : "2px solid transparent",
          }}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
