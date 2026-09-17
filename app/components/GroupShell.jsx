"use client";

import { useState, useEffect } from "react";
import { Music, ListMusic, Home, BookOpen, NotebookPen, Settings, LayoutGrid, MessageCircle, MessagesSquare } from "lucide-react";
import GroupBottomNav from "./GroupBottomNav";
import GroupSidebar from "./GroupSidebar";
import GroupNewsTab from "./GroupNewsTab";
import GroupEventsTab from "./GroupEventsTab";
import GroupPrayerTab from "./GroupPrayerTab";
import RosterTab from "./RosterTab";
import { SkeletonList } from "./Skeleton";
import TabTransition from "./TabTransition";
import SongsTab from "./SongsTab";
import SetlistsTab from "./SetlistsTab";
import ProgramsTab from "./ProgramsTab";
import DirectMessagesTab from "./DirectMessagesTab";
import GroupChatTab from "./GroupChatTab";
import TodayTab from "./TodayTab";
import PlanTab from "./PlanTab";
import JournalTab from "./JournalTab";
import SettingsView from "./SettingsView";
import HelpView from "./HelpView";
import AttributionView from "./AttributionView";
import { getPlan, DEFAULT_PLAN_ID } from "@/lib/planRegistry";

// Tabs that append after the shared News/Events/Prayer/Roster set.
const APPEND_FEATURE_TABS = {
  songs_setlists: [
    { key: "songs", label: "Songs", icon: Music },
    { key: "setlists", label: "Setlists", icon: ListMusic },
  ],
  programs: [{ key: "programs", label: "Programs", icon: LayoutGrid }],
  direct_messages: [{ key: "dm", label: "Messages", icon: MessageCircle }],
  group_chat: [{ key: "chat", label: "Chat", icon: MessagesSquare }],
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
export default function GroupShell({
  group,
  myRole,
  currentUserId,
  onBackToHub,
  onOpenBiblePassage,
  refreshMe,
  initialTab,
  initialThreadId,
  initialChannel,
}) {
  const features = group.features || [];
  const hasReadingPlan = features.includes("reading_plan_journal");
  const [tab, setTab] = useState(initialTab || (hasReadingPlan ? "today" : "news"));
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
  //
  // WHICH plan is active is resolved here too: if the group has locked
  // its reading plan, everyone in it uses that plan regardless of their
  // own personal choice; otherwise each member's own active_reading_plan
  // applies. Progress/journal are fetched scoped to whichever plan_id
  // that resolves to, so switching plans (or being in a locked group on
  // a different plan than your personal pick) never mixes data across
  // plans.
  const [dayNum, setDayNum] = useState(1);
  const [progress, setProgress] = useState({});
  const [journal, setJournal] = useState({});
  const [readingPlanLoaded, setReadingPlanLoaded] = useState(false);
  const [activePlanId, setActivePlanId] = useState(DEFAULT_PLAN_ID);
  const [planLocked, setPlanLocked] = useState(false);

  useEffect(() => {
    if (!hasReadingPlan) return;
    let cancelled = false;

    (async () => {
      const groupRes = await fetch(`/api/groups/${group.id}`);
      const groupData = await groupRes.json();
      const locked = groupRes.ok && groupData.group?.reading_plan_locked;
      const lockedPlanId = groupData.group?.reading_plan_id;

      let resolvedPlanId = DEFAULT_PLAN_ID;
      if (locked) {
        resolvedPlanId = lockedPlanId || DEFAULT_PLAN_ID;
      } else {
        const selRes = await fetch("/api/reading-plan/selection");
        const selData = await selRes.json();
        resolvedPlanId = (selRes.ok && selData.active_reading_plan) || DEFAULT_PLAN_ID;
      }

      const [p, j] = await Promise.all([
        fetch(`/api/reading-plan/progress?plan_id=${resolvedPlanId}`).then((r) => r.json()),
        fetch(`/api/reading-plan/journal?plan_id=${resolvedPlanId}`).then((r) => r.json()),
      ]);

      if (cancelled) return;
      setPlanLocked(Boolean(locked));
      setActivePlanId(resolvedPlanId);
      setProgress(p.progress || {});
      setJournal(j.journal || {});
      setReadingPlanLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [hasReadingPlan, group.id]);

  const activePlan = getPlan(activePlanId);

  // Called when a member picks a different plan for themselves (only
  // available when their group hasn't locked the plan) -- re-resolves
  // everything against the new plan_id, same as the initial load.
  const switchPlan = async (newPlanId) => {
    await fetch("/api/reading-plan/selection", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: newPlanId }),
    });
    setReadingPlanLoaded(false);
    const [p, j] = await Promise.all([
      fetch(`/api/reading-plan/progress?plan_id=${newPlanId}`).then((r) => r.json()),
      fetch(`/api/reading-plan/journal?plan_id=${newPlanId}`).then((r) => r.json()),
    ]);
    setActivePlanId(newPlanId);
    setProgress(p.progress || {});
    setJournal(j.journal || {});
    setDayNum(1);
    setReadingPlanLoaded(true);
  };

  return (
    <div className="h-dvh flex flex-col bg-paper overflow-hidden">
      <header
        className="sticky top-0 z-30 flex justify-between items-center px-4 py-3 bg-[#132560] text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBackToHub} className="text-sm flex-shrink-0">
            ← Home
          </button>
          <strong
            className="font-serif tracking-wide truncate"
            style={{
              color: "#fff",
              textShadow:
                "-1px -1px 0 #C41E28, 1px -1px 0 #C41E28, -1px 1px 0 #C41E28, 1px 1px 0 #C41E28, 2px 2px 3px rgba(0,0,0,0.7)",
            }}
          >
            {displayName}
          </strong>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="text-white/90 p-1 flex-shrink-0"
        >
          <Settings size={22} />
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        <GroupSidebar tab={tab} setTab={setTab} prependTabs={prependTabs} appendTabs={appendTabs} />
        <main className="flex-1 overflow-y-auto">
          <TabTransition tabKey={tab}>
            {hasReadingPlan && !readingPlanLoaded && ["today", "plan", "journal"].includes(tab) ? (
              <div className="px-5 pt-4"><SkeletonList count={2} /></div>

            ) : (
              <>
                {tab === "today" && (
                  <TodayTab
                    plan={activePlan}
                    progress={progress}
                    setProgress={setProgress}
                    activePlanId={activePlanId}
                    dayNum={dayNum}
                    setDayNum={setDayNum}
                    setTab={setTab}
                    onOpenBiblePassage={onOpenBiblePassage}
                  />
                )}
                {tab === "plan" && (
                  <PlanTab
                    plan={activePlan}
                    progress={progress}
                    dayNum={dayNum}
                    setDayNum={setDayNum}
                    setTab={setTab}
                    planLocked={planLocked}
                    onSwitchPlan={switchPlan}
                  />
                )}
                {tab === "journal" && (
                  <JournalTab
                    plan={activePlan}
                    activePlanId={activePlanId}
                    dayNum={dayNum}
                    setDayNum={setDayNum}
                    journal={journal}
                    setJournal={setJournal}
                  />
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
            {tab === "roster" && (
              <RosterTab
                groupId={group.id}
                myRole={effectiveRole}
                onRenamed={setDisplayName}
                onLeave={() => {
                  refreshMe();
                  onBackToHub();
                }}
              />
            )}
            {features.includes("songs_setlists") && tab === "songs" && (
              <SongsTab groupId={group.id} canManage={canManage} />
            )}
            {features.includes("songs_setlists") && tab === "setlists" && (
              <SetlistsTab groupId={group.id} canManage={canManage} />
            )}
            {features.includes("programs") && tab === "programs" && (
              <ProgramsTab groupId={group.id} canManage={canManage} />
            )}
            {features.includes("direct_messages") && tab === "dm" && (
              <DirectMessagesTab groupId={group.id} currentUserId={currentUserId} initialThreadId={initialThreadId} />
            )}
            {features.includes("group_chat") && tab === "chat" && (
              <GroupChatTab
                groupId={group.id}
                currentUserId={currentUserId}
                canManage={canManage}
                initialChannel={initialChannel}
              />
            )}
          </TabTransition>
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
