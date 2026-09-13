"use client";

import { useState } from "react";
import GroupBottomNav from "./GroupBottomNav";
import GroupNewsTab from "./GroupNewsTab";
import GroupEventsTab from "./GroupEventsTab";
import GroupPrayerTab from "./GroupPrayerTab";
import RosterTab from "./RosterTab";
import SongsTab from "./SongsTab";
import SetlistsTab from "./SetlistsTab";
import ReadingPlanTab from "./ReadingPlanTab";
import SettingsView from "./SettingsView";
import HelpView from "./HelpView";

const FEATURE_TABS = {
  songs_setlists: [
    { key: "songs", label: "Songs" },
    { key: "setlists", label: "Setlists" },
  ],
  reading_plan_journal: [{ key: "reading_plan", label: "Reading Plan" }],
};

// Entered by tapping "Launch" on a group in the Hub. While here, the
// universal News/Events/Hub/Bible nav is completely replaced by this
// group's own contextual nav — per the project's decision that being
// inside a sub-app shows only that sub-app's content. "Back to Hub" is
// the only way out, by design. Every group gets News/Events/Prayer/Roster
// for free; optional modules (Songs/Setlists, Reading Plan/Journal) are
// bolted on per-group via `features`, not tied to a fixed "type".
export default function GroupShell({ group, myRole, currentUserId, onBackToHub, onOpenBiblePassage }) {
  const [tab, setTab] = useState("roster");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const effectiveRole = group.isAdmin ? "admin" : myRole;
  const canManage = effectiveRole === "leader" || effectiveRole === "admin";
  const features = group.features || [];

  const extraTabs = features.flatMap((f) => FEATURE_TABS[f] || []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          background: "#16296B",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onBackToHub}
            style={{ background: "none", border: "none", color: "#fff", fontSize: 16, cursor: "pointer" }}
          >
            ← Hub
          </button>
          <strong>{group.name}</strong>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          style={{ background: "none", border: "1px solid #fff", color: "#fff", borderRadius: 4, padding: "4px 8px", fontSize: 12 }}
        >
          ⚙
        </button>
      </header>

      <main style={{ flex: 1 }}>
        {tab === "news" && <GroupNewsTab groupId={group.id} canManage={canManage} />}
        {tab === "events" && <GroupEventsTab groupId={group.id} canManage={canManage} />}
        {tab === "prayer" && (
          <GroupPrayerTab groupId={group.id} canManage={canManage} currentUserId={currentUserId} />
        )}
        {tab === "roster" && <RosterTab groupId={group.id} myRole={effectiveRole} />}
        {features.includes("songs_setlists") && tab === "songs" && (
          <SongsTab groupId={group.id} canManage={canManage} />
        )}
        {features.includes("songs_setlists") && tab === "setlists" && (
          <SetlistsTab groupId={group.id} canManage={canManage} />
        )}
        {features.includes("reading_plan_journal") && tab === "reading_plan" && (
          <ReadingPlanTab onOpenBiblePassage={onOpenBiblePassage} />
        )}
      </main>

      <GroupBottomNav tab={tab} setTab={setTab} extraTabs={extraTabs} />

      {settingsOpen && (
        <SettingsView
          onClose={() => setSettingsOpen(false)}
          onOpenHelp={() => {
            setSettingsOpen(false);
            setHelpOpen(true);
          }}
        />
      )}
      {helpOpen && <HelpView onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
