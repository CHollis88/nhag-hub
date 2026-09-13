"use client";

import { useState } from "react";
import { Music, ListMusic, BookOpen } from "lucide-react";
import GroupBottomNav from "./GroupBottomNav";
import GroupSidebar from "./GroupSidebar";
import GroupNewsTab from "./GroupNewsTab";
import GroupEventsTab from "./GroupEventsTab";
import GroupPrayerTab from "./GroupPrayerTab";
import RosterTab from "./RosterTab";
import SongsTab from "./SongsTab";
import SetlistsTab from "./SetlistsTab";
import ReadingPlanTab from "./ReadingPlanTab";
import SettingsView from "./SettingsView";
import HelpView from "./HelpView";
import AttributionView from "./AttributionView";

const FEATURE_TABS = {
  songs_setlists: [
    { key: "songs", label: "Songs", icon: Music },
    { key: "setlists", label: "Setlists", icon: ListMusic },
  ],
  reading_plan_journal: [{ key: "reading_plan", label: "Plan", icon: BookOpen }],
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
  const [attributionOpen, setAttributionOpen] = useState(false);
  const [displayName, setDisplayName] = useState(group.name);
  const effectiveRole = group.isAdmin ? "admin" : myRole;
  const canManage = effectiveRole === "leader" || effectiveRole === "admin";
  const features = group.features || [];

  const extraTabs = features.flatMap((f) => FEATURE_TABS[f] || []);

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <header className="flex justify-between items-center px-4 py-3 bg-navy text-white">
        <div className="flex items-center gap-3">
          <button onClick={onBackToHub} className="text-sm">
            ← Home
          </button>
          <strong className="font-serif">{displayName}</strong>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="border border-white/40 rounded px-2 py-1 text-xs"
        >
          ⚙
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        <GroupSidebar tab={tab} setTab={setTab} extraTabs={extraTabs} />
        <main className="flex-1 overflow-y-auto">
          {tab === "news" && <GroupNewsTab groupId={group.id} canManage={canManage} />}
          {tab === "events" && <GroupEventsTab groupId={group.id} canManage={canManage} />}
          {tab === "prayer" && (
            <GroupPrayerTab groupId={group.id} canManage={canManage} currentUserId={currentUserId} />
          )}
          {tab === "roster" && <RosterTab groupId={group.id} myRole={effectiveRole} onRenamed={setDisplayName} />}
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
      </div>

      <GroupBottomNav tab={tab} setTab={setTab} extraTabs={extraTabs} />

      {settingsOpen && (
        <SettingsView
          isAdmin={effectiveRole === "admin"}
          onClose={() => setSettingsOpen(false)}
          onOpenHelp={() => {
            setSettingsOpen(false);
            setHelpOpen(true);
          }}
          onOpenAttribution={() => {
            setSettingsOpen(false);
            setAttributionOpen(true);
          }}
        />
      )}
      {helpOpen && <HelpView onClose={() => setHelpOpen(false)} />}
      {attributionOpen && <AttributionView onClose={() => setAttributionOpen(false)} />}
    </div>
  );
}
