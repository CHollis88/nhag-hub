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
    <nav className="sticky bottom-0 flex border-t border-line bg-card">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`flex-1 py-3.5 text-sm border-t-2 ${
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
