"use client";

import { useState, useEffect, useRef } from "react";
import { Music, ListMusic, Home, BookOpen, NotebookPen, Settings, LayoutGrid, MessageCircle, MessagesSquare, RotateCw, FileText, PlayCircle } from "lucide-react";
import GroupBottomNav from "./GroupBottomNav";
import GroupSidebar from "./GroupSidebar";
import GroupNewsTab from "./GroupNewsTab";
import GroupEventsTab from "./GroupEventsTab";
import GroupPrayerTab from "./GroupPrayerTab";
import RosterTab from "./RosterTab";
import { SkeletonList } from "./Skeleton";
import TabTransition from "./TabTransition";
import SongsTab from "./SongsTab";
import MediaTab from "./MediaTab";
import SetlistsTab from "./SetlistsTab";
import ProgramsTab from "./ProgramsTab";
import CurriculumTab from "./CurriculumTab";
import DirectMessagesTab from "./DirectMessagesTab";
import GroupChatTab from "./GroupChatTab";
import TodayTab from "./TodayTab";
import PlanTab from "./PlanTab";
import JournalTab from "./JournalTab";
import SettingsView from "./SettingsView";
import HelpView from "./HelpView";
import AttributionView from "./AttributionView";
import PatchNotesView from "./PatchNotesView";
import { PATCH_NOTES } from "@/lib/patchNotes";
import { getPlan, DEFAULT_PLAN_ID } from "@/lib/planRegistry";
import { useKeyboardVisible } from "@/lib/useKeyboardVisible";
import { useViewportHeight } from "@/lib/useViewportHeight";
import { hasNewContent, markSeen } from "@/lib/lastSeen";

// Tabs that append after the shared News/Events/Prayer/Roster set.
const APPEND_FEATURE_TABS = {
  songs_setlists: [
    { key: "songs", label: "Songs", icon: Music },
    { key: "setlists", label: "Setlists", icon: ListMusic },
    { key: "media", label: "Media", icon: PlayCircle },
  ],
  programs: [{ key: "programs", label: "Programs", icon: LayoutGrid }],
  direct_messages: [{ key: "dm", label: "Messages", icon: MessageCircle }],
  curriculum: [{ key: "curriculum", label: "Curriculum", icon: FileText }],
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
  const [patchNotesOpen, setPatchNotesOpen] = useState(false);
  const [displayName, setDisplayName] = useState(group.name);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const effectiveRole = group.isAdmin ? "admin" : myRole;
  const canManage = effectiveRole === "leader" || effectiveRole === "admin";
  // Hides the bottom tab bar while an on-screen keyboard is open (see
  // the hook for why) -- most noticeable in Messages/Chat, where a
  // compose bar sits right above where the nav normally is, but this
  // covers any text entry in any tab, not just those two.
  const keyboardVisible = useKeyboardVisible();
  // Real, live-updating viewport height in pixels -- see the hook for
  // why h-dvh alone isn't enough. Bound as an inline style on the root
  // below rather than relied on as a Tailwind class, since several
  // mobile browsers don't shrink dvh for an on-screen keyboard at all;
  // without this, a keyboard opening left the whole shell (compose bar,
  // bottom nav) sized for the PRE-keyboard height, which is exactly why
  // the compose bar could end up hidden behind the keyboard or the nav
  // bar, or a short conversation could show a stray gap underneath it.
  const viewportHeight = useViewportHeight();

  // Powers the "something's new" dot on this group's own tab bar. See
  // /api/groups/[id]/latest-content for the News/Events/Prayer-vs-Chat/DM
  // distinction -- the first three compare against a locally-stored
  // "last seen" timestamp (namespaced per group so one ministry's News
  // dot is never confused with another's, or with the church-wide News
  // tab's own separate tracking); dm/chat come back as real,
  // server-computed unread state and need no local tracking at all.
  const [latestContent, setLatestContent] = useState(null);
  const loadLatestContentRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`/api/groups/${group.id}/latest-content`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) setLatestContent(data);
        })
        .catch(() => {});
    };
    loadLatestContentRef.current = load;
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 45000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [group.id]);

  const badges = latestContent
    ? {
        news: hasNewContent(`group:${group.id}:news`, latestContent.news),
        events: hasNewContent(`group:${group.id}:events`, latestContent.events),
        prayer: hasNewContent(`group:${group.id}:prayer`, latestContent.prayer),
        dm: latestContent.dm_unread_count > 0,
        chat: latestContent.chat_unread,
      }
    : {};

  // Switching to a tab marks it seen for the client-tracked badges
  // (News/Events/Prayer). dm/chat are real server-tracked state instead
  // (last_read_at, updated the moment a thread/channel is actually
  // opened by DirectMessagesTab/GroupChatTab) -- refetching shortly
  // after leaving either one picks that up promptly, rather than
  // waiting on the next 45s poll to clear their dot.
  const switchTab = (nextTab) => {
    markSeen(`group:${group.id}:${nextTab}`);
    if (tab === "dm" || tab === "chat") {
      setTimeout(() => loadLatestContentRef.current?.(), 600);
    }
    setTab(nextTab);
  };

  // Chat's two channels (migration_027) are now independently toggleable
  // (Cam's decision) -- a ministry can turn on Leaders Only without also
  // turning on Members, or vice versa. That means whether the Chat tab
  // even appears now depends on role, not just the feature array: a
  // regular member should never see the tab at all if only the leaders
  // channel is on, since they have no access to it either way.
  const hasChatMembers = features.includes("chat_members");
  const hasChatLeaders = features.includes("chat_leaders");
  const showChatTab = hasChatMembers || (canManage && hasChatLeaders);

  const prependTabs = features.flatMap((f) => PREPEND_FEATURE_TABS[f] || []);
  const appendTabs = [
    ...features.flatMap((f) => APPEND_FEATURE_TABS[f] || []),
    ...(showChatTab ? [{ key: "chat", label: "Chat", icon: MessagesSquare }] : []),
  ];

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
    <div className="flex flex-col bg-paper overflow-hidden" style={{ height: viewportHeight }}>
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
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => {
              // Same idea as the main app header's refresh button: bump a
              // nonce that's part of TabTransition's key, which remounts
              // the current tab's content so it refetches its own data
              // fresh, plus refresh the badge data this header itself
              // depends on.
              setRefreshNonce((n) => n + 1);
              loadLatestContentRef.current?.();
            }}
            aria-label="Refresh"
            title="Refresh"
            className="text-white/90 p-1"
          >
            <RotateCw size={20} />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="text-white/90 p-1"
          >
            <Settings size={22} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <GroupSidebar tab={tab} setTab={switchTab} prependTabs={prependTabs} appendTabs={appendTabs} badges={badges} />
        <main className="flex-1 overflow-y-auto">
          <TabTransition tabKey={`${tab}-${refreshNonce}`}>
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
                    setTab={switchTab}
                    onOpenBiblePassage={onOpenBiblePassage}
                  />
                )}
                {tab === "plan" && (
                  <PlanTab
                    plan={activePlan}
                    progress={progress}
                    dayNum={dayNum}
                    setDayNum={setDayNum}
                    setTab={switchTab}
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
            {features.includes("songs_setlists") && tab === "media" && (
              <MediaTab groupId={group.id} />
            )}
            {features.includes("programs") && tab === "programs" && (
              <ProgramsTab groupId={group.id} canManage={canManage} />
            )}
            {features.includes("curriculum") && tab === "curriculum" && (
              <CurriculumTab groupId={group.id} canManage={canManage} />
            )}
            {features.includes("direct_messages") && tab === "dm" && (
              <DirectMessagesTab
                groupId={group.id}
                currentUserId={currentUserId}
                canManage={canManage}
                initialThreadId={initialThreadId}
              />
            )}
            {showChatTab && tab === "chat" && (
              <GroupChatTab
                groupId={group.id}
                currentUserId={currentUserId}
                canManage={canManage}
                hasMembersChannel={hasChatMembers}
                hasLeadersChannel={hasChatLeaders}
                initialChannel={initialChannel}
              />
            )}
          </TabTransition>
        </main>
      </div>

      {!keyboardVisible && (
        <GroupBottomNav tab={tab} setTab={switchTab} prependTabs={prependTabs} appendTabs={appendTabs} badges={badges} />
      )}

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
          onOpenPatchNotes={() => {
            setSettingsOpen(false);
            markSeen("whats-new");
            setPatchNotesOpen(true);
          }}
          hasNewPatchNotes={hasNewContent("whats-new", PATCH_NOTES[0]?.date)}
        />
      )}
      {patchNotesOpen && <PatchNotesView onClose={() => setPatchNotesOpen(false)} />}
      {helpOpen && <HelpView onClose={() => setHelpOpen(false)} isLeader={canManage} />}
      {attributionOpen && <AttributionView onClose={() => setAttributionOpen(false)} />}
    </div>
  );
}
