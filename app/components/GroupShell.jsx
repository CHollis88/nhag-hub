"use client";

import { useState, useEffect } from "react";
import { Music, ListMusic, Home, BookOpen, NotebookPen } from "lucide-react";
import GroupBottomNav from "./GroupBottomNav";
import GroupSidebar from "./GroupSidebar";
import GroupNewsTab from "./GroupNewsTab";
import GroupEventsTab from "./GroupEventsTab";
import GroupPrayerTab from "./GroupPrayerTab";
import RosterTab from "./RosterTab";
import SongsTab from "./SongsTab";
import SetlistsTab from "./SetlistsTab";
import TodayTab from "./TodayTab";
import PlanTab from "./PlanTab";
import JournalTab from "./JournalTab";
import SettingsView from "./SettingsView";
import HelpView from "./HelpView";
import AttributionView from "./AttributionView";

// Tabs that append after the shared News/Events/Prayer/Roster set.
const APPEND_FEATURE_TABS = {
  songs_setlists: [
    { key: "songs", label: "Songs", icon: Music },
    { key: "setlists", label: "Setlists", icon: ListMusic },
  ],
};

// Tabs that come FIRST, before News/Events/Prayer -- per the project's
// decision, Today/Plan/Journal are each their own top-level tab (not a
// single "Reading Plan" tab with its own internal switcher), and lead
// the nav for a reading-plan-style group.
const PREPEND_FEATURE_TABS = {
  reading_plan_journal: [
    { key: "today", label: "Today", icon: Home },
    { key: "plan", label: "Plan", icon: BookOpen },
    { key: "journal", label: "Journal", icon: NotebookPen },
  ],
};

// Entered by tapping "Launch" on a group in the Hub. While here, the
// universal News/Events/Hub/Bible nav is completely replaced by this
// group's own contextual nav — per the project's decision that being
// inside a sub-app shows only that sub-app's content. "Back to Hub" is
// the only way out, by design. Every group gets News/Events/Prayer/Roster
// for free; optional modules (Songs/Setlists, Today/Plan/Journal) are
// bolted on per-group via `features`, not tied to a fixed "type".
export default function GroupShell({ group, myRole, currentUserId, onBackToHub, onOpenBiblePassage }) {
  const features = group.features || [];
  const hasReadingPlan = features.includes("reading_plan_journal");
  const [tab, setTab] = useState(hasReadingPlan ? "today" : "news");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [attributionOpen, setAttributionOpen] = useState(false);
  const [displayName, setDisplayName] = useState(group.name);
  const effectiveRole = group.isAdmin ? "admin" : myRole;
  const canManage = effectiveRole === "leader" || effectiveRole === "admin";

  const prependTabs = features.flatMap((f) => PREPEND_FEATURE_TABS[f] || []);
  const appendTabs = features.flatMap((f) => APPEND_FEATURE_TABS[f] || []);

  // Today/Plan/Journal are personal to the signed-in user (see
  // migration_006_reading_plan_journal.sql), not stored per-group --
  // shared here so all three tabs stay in sync (e.g. changing the day in
  // Today reflects immediately in Plan and Journal too), same as when
  // they lived together inside one ReadingPlanTab component.
  const [dayNum, setDayNum] = useState(1);
  const [progress, setProgress] = useState({});
  const [journal, setJournal] = useState({});
  const [readingPlanLoaded, setReadingPlanLoaded] = useState(false);

  useEffect(() => {
    if (!hasReadingPlan) return;
    Promise.all([
      fetch("/api/reading-plan/progress").then((r) => r.json()),
      fetch("/api/reading-plan/journal").then((r) => r.json()),
    ]).then(([p, j]) => {
      setProgress(p.progress || {});
      setJournal(j.journal || {});
      setReadingPlanLoaded(true);
    });
  }, [hasReadingPlan]);

  return (
    <div className="h-screen flex flex-col bg-paper overflow-hidden">
      <header
        className="sticky top-0 z-30 flex justify-between items-center px-4 py-3 bg-navy text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
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
        <GroupSidebar tab={tab} setTab={setTab} prependTabs={prependTabs} appendTabs={appendTabs} />
        <main className="flex-1 overflow-y-auto">
          {hasReadingPlan && !readingPlanLoaded && ["today", "plan", "journal"].includes(tab) ? (
            <div className="px-5 pt-4"><p className="text-sm text-inkfaint">Loading…</p></div>
          ) : (
            <>
              {tab === "today" && (
                <TodayTab
                  progress={progress}
                  setProgress={setProgress}
                  dayNum={dayNum}
                  setDayNum={setDayNum}
                  setTab={setTab}
                  onOpenBiblePassage={onOpenBiblePassage}
                />
              )}
              {tab === "plan" && (
                <PlanTab progress={progress} dayNum={dayNum} setDayNum={setDayNum} setTab={setTab} />
              )}
              {tab === "journal" && (
                <JournalTab dayNum={dayNum} setDayNum={setDayNum} journal={journal} setJournal={setJournal} />
              )}
            </>
          )}
          {tab === "news" && (
            <GroupNewsTab groupId={group.id} canManage={canManage} showClassOption={!features.includes("songs_setlists")} />
          )}
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
        </main>
      </div>

      <GroupBottomNav tab={tab} setTab={setTab} prependTabs={prependTabs} appendTabs={appendTabs} />

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
