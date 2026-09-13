"use client";

const TABS = [
  { key: "news", label: "News" },
  { key: "events", label: "Events" },
  { key: "hub", label: "Hub" },
  { key: "bible", label: "Bible" },
];

// The universal bottom nav. Only ever renders these four tabs, per the
// project's decision that global tabs are News/Events/Hub/Bible -- no
// Journal here (that stays exclusive to the Young Adults app), and no
// Sermons yet (deferred to a later phase).
export default function BottomNav({ tab, setTab }) {
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
      {TABS.map((t) => (
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
