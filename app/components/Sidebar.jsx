"use client";

// Desktop counterpart to BottomNav -- same four tabs, same order, just a
// persistent left sidebar instead of a bottom bar once there's enough
// screen width to spare. Hidden below the md breakpoint; BottomNav is
// hidden at and above it, so exactly one of the two is ever visible.
const TABS = [
  { key: "hub", label: "Home" },
  { key: "bible", label: "Bible" },
  { key: "news", label: "News" },
  { key: "events", label: "Events" },
];

export default function Sidebar({ tab, setTab }) {
  return (
    <nav className="hidden md:flex flex-col w-56 flex-shrink-0 bg-card border-r border-line py-4">
      {TABS.map((t) => (
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
