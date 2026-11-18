"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import HomeGetStartedCard from "./HomeGetStartedCard";
import MinistryPreview from "./MinistryPreview";
import { readableTextColor } from "@/lib/colorContrast";
import { formatTime12h } from "@/lib/formatTime";
import { todayLocal } from "@/lib/localDate";
import { requestJson } from "@/lib/request";
import { useResource } from "@/lib/useResource";
import { HOME_GROUPS, HOME_EVENTS, HOME_NEWS } from "@/lib/homeData";
import { useToast } from "./ToastProvider";
import { VerseOfDayCard, ThisSundayCard, ChurchPrayerCard, ChurchPrayerTile, WelcomeCard } from "./HomeCards";

const DEFAULT_TILE_COLOR = "#4A5568";
const CHURCH_WIDE_COLOR = "#16296B"; // same brand navy used for "Church-wide" everywhere else (Calendar)

// One of YOUR ministries. The whole card is a single real button that opens
// the ministry -- the most natural thing to tap (the icon, the name) now does
// what people expect, instead of opening an "About" sheet and needing a second
// tap on a small "Launch" button. (Before, the card body was a <div
// role="button"> that keyboards could not reach, with a real button nested
// inside it.) The pill at the bottom is just a visible label for the action,
// not a second control. Only ministries you belong to use this card -- others
// are the rows below -- so there is no Join / Pending state here.
function MinistryTile({ group, myRole, onOpen }) {
  const bg = group.tile_color || DEFAULT_TILE_COLOR;
  const role = myRole === "leader" ? "Leader" : "Member";
  const meta = [group.type, role].filter(Boolean).join(" · ");

  // The whole card opens the ministry; "Open ›" is a quiet cue that it can be
  // tapped, not a second button. Compact at every size -- it no longer grows
  // into a poster on desktop. Leader names live in the Directory and the
  // ministry preview, not here.
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${group.name}`}
      className="sp-card p-0 overflow-hidden flex flex-col h-full w-full text-left"
    >
      <div className="h-1 flex-shrink-0 w-full" style={{ background: bg }} />
      <div className="px-2 py-2.5 md:p-4 flex flex-col items-center text-center flex-1 w-full">
        {group.image_url ? (
          <img
            src={group.image_url}
            alt=""
            className="w-11 h-11 md:w-14 md:h-14 rounded-xl object-cover flex-shrink-0 mb-1.5"
          />
        ) : (
          <div
            className="w-11 h-11 md:w-14 md:h-14 rounded-xl flex-shrink-0 flex items-center justify-center font-serif text-lg md:text-xl mb-1.5"
            style={{ background: bg, color: readableTextColor(bg) }}
            aria-hidden="true"
          >
            {group.name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <span className="font-serif text-sm md:text-lg text-ink leading-snug break-words">{group.name}</span>
        <span className="hidden md:block text-xs text-inkfaint break-words mt-0.5">{meta}</span>
        <span aria-hidden="true" className="hidden md:block mt-auto pt-2 text-xs font-medium text-accent">
          Open ›
        </span>
      </div>
    </button>
  );
}

// A ministry you are NOT in: deliberately a different shape from the card above
// -- a compact, muted row -- so browsing never looks identical to (or as
// prominent as) the ones you belong to. Two separate controls, side by side:
// the left side opens the "About this ministry" sheet, and "Request to Join" is
// its own real button with a proper tap target (it used to be a small
// underlined link inside a clickable div).
function BrowseMinistryRow({ group, leaders, isPending, onRequestJoin, onPreview }) {
  const bg = group.tile_color || DEFAULT_TILE_COLOR;

  return (
    <div className="flex items-center gap-2 bg-paper border border-linesoft rounded-lg pl-3 pr-2 py-1.5">
      <button
        type="button"
        onClick={onPreview}
        aria-label={`About ${group.name}`}
        className="flex items-center gap-3 flex-1 min-w-0 min-h-[44px] text-left opacity-90"
      >
        {group.image_url ? (
          <img src={group.image_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 grayscale-[30%]" />
        ) : (
          <div
            className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center font-serif text-sm opacity-80"
            style={{ background: bg, color: readableTextColor(bg) }}
            aria-hidden="true"
          >
            {group.name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-inksoft truncate">{group.name}</span>
          {leaders?.length > 0 && <span className="block text-xs text-inkfaint truncate">{leaders.join(", ")}</span>}
        </span>
      </button>
      {isPending ? (
        <span className="text-[0.6875rem] font-medium text-inksoft bg-line/40 rounded-full px-2.5 py-1 flex-shrink-0" aria-label="Request pending">Pending</span>
      ) : (
        <button
          type="button"
          onClick={onRequestJoin}
          aria-label={`Request to join ${group.name}`}
          className="sp-btn-secondary text-xs px-3 min-h-[44px] flex-shrink-0"
        >
          <span className="sm:hidden">Request</span>
          <span className="hidden sm:inline">Request to Join</span>
        </button>
      )}
    </div>
  );
}

// Your next event (church-wide or from a ministry you're in). Shown beside
// the service times in the This Sunday card (v71.29) to save room on Home.
function useNextEvent(me) {
  // Through the shared screen cache: coming back to Home shows this at once
  // and only asks the server again once it's a couple of minutes old.
  const { data: mine } = useResource(HOME_EVENTS.key, HOME_EVENTS.fetcher, { staleMs: HOME_EVENTS.staleMs });

  const events = useMemo(() => {
    if (!mine) return null;
    const myGroups = (me?.memberships || []).filter((m) => m.status === "active");
    const today = todayLocal();
    const globalEvents = (mine.global || []).map((ev) => ({
      ...ev,
      sourceName: "Church-wide",
      color: CHURCH_WIDE_COLOR,
    }));
    const groupEvents = myGroups.flatMap((m) =>
      ((mine.groups || {})[m.group_id] || []).map((ev) => ({
        ...ev,
        sourceName: m.group?.name || "Ministry",
        color: m.group?.tile_color || DEFAULT_TILE_COLOR,
      }))
    );
    return [...globalEvents, ...groupEvents]
      .filter((e) => e.event_date >= today)
      .sort((a, b) => {
        if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
        return (a.event_time || "99:99").localeCompare(b.event_time || "99:99");
      })
      .slice(0, 1);
  }, [mine, me]);

  return events && events.length ? events[0] : null;
}

function AnnouncementsPreview({ onSeeAll }) {
  // Same cache entry the News tab uses, so whichever opens first fills both,
  // and posting news (which refreshes that entry) updates Home too.
  const { data: allNews } = useResource(HOME_NEWS.key, HOME_NEWS.fetcher, { staleMs: HOME_NEWS.staleMs });
  const news = allNews ? allNews.slice(0, 1) : null;

  if (news === null || news.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs uppercase tracking-wide text-inkfaint">Latest Announcement</p>
        <button onClick={onSeeAll} className="text-xs text-accent underline py-2 -my-2 px-2 -mx-2">See all</button>
      </div>
      <div className="space-y-2">
        {news.map((n) => (
          <button type="button" onClick={onSeeAll} key={n.id} className="sp-card w-full text-left flex items-center gap-3">
            <span className="flex-1 min-w-0">
              <span className="block font-medium text-ink text-sm">{n.title}</span>
              <span className="block text-xs text-inksoft line-clamp-2">{n.body}</span>
            </span>
            <ChevronRight size={16} className="text-inkfaint flex-shrink-0" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

// "From your ministries": the newest announcements across every ministry you
// belong to, newest first, each tagged with its ministry. Tapping one opens
// that ministry on its News tab. The data comes with the events request Home
// already makes (/api/events/mine?include=news) -- no extra call -- and it
// follows the same rules as each ministry's News tab (published only;
// leader-only posts only for that ministry's leaders).
const SHOW_FIRST = 3;
function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function MinistryAnnouncements({ me, groups, onOpenGroup }) {
  const { data: mine } = useResource(HOME_EVENTS.key, HOME_EVENTS.fetcher, { staleMs: HOME_EVENTS.staleMs });
  const [showAll, setShowAll] = useState(false);
  const byId = useMemo(() => Object.fromEntries((groups || []).map((g) => [g.id, g])), [groups]);
  const roleOf = useMemo(
    () => Object.fromEntries(me.memberships.filter((m) => m.status === "active").map((m) => [m.group_id, m.role])),
    [me.memberships]
  );

  const posts = (mine?.group_news || []).filter((n) => byId[n.group_id]);
  if (posts.length === 0) return null;
  const shown = showAll ? posts : posts.slice(0, SHOW_FIRST);

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs uppercase tracking-wide text-inkfaint">From your ministries</p>
        {posts.length > SHOW_FIRST && (
          <button onClick={() => setShowAll((v) => !v)} className="text-xs text-accent underline py-2 -my-2 px-2 -mx-2">
            {showAll ? "Show less" : `Show ${posts.length - SHOW_FIRST} more`}
          </button>
        )}
      </div>
      <div className="sp-card p-0 divide-y divide-linesoft overflow-hidden">
        {shown.map((n) => {
          const g = byId[n.group_id];
          const bg = g.tile_color || DEFAULT_TILE_COLOR;
          return (
            <button
              type="button"
              key={n.id}
              onClick={() => onOpenGroup(g.id, g.name, roleOf[g.id], g.features, { initialTab: "news" })}
              className="w-full text-left flex items-start gap-3 px-3 py-2.5 hover:bg-paper"
              aria-label={`${n.title}, from ${g.name}, ${timeAgo(n.created_at)}`}
            >
              {g.image_url ? (
                <img src={g.image_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 mt-0.5" />
              ) : (
                <span
                  className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-serif text-sm mt-0.5"
                  style={{ background: bg, color: readableTextColor(bg) }}
                  aria-hidden="true"
                >
                  {g.name?.[0]?.toUpperCase() || "?"}
                </span>
              )}
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline gap-2">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-wide truncate text-inksoft">
                    {g.name}
                  </span>
                  <span className="text-[0.6875rem] text-inkfaint flex-shrink-0 ml-auto">{timeAgo(n.created_at)}</span>
                </span>
                <span className="block font-medium text-ink text-sm leading-snug">{n.title}</span>
                {n.body && <span className="text-xs text-inksoft line-clamp-1 break-words">{n.body}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Home: the church-wide dashboard. Previews upcoming events and
// announcements, then shows every ministry as a tile (icon, tile color,
// leader names) -- yours to Launch into, others to request joining.
// Everything admin-only lives in the separate Admin Toolbox below.
export default function HomeTab({ me, refreshMe, onOpenGroup, onGoToTab, onOpenSettings, onOpenDirectory, onOpenChurchPrayer, onOpenPassage }) {
  const toast = useToast();
  const [previewGroup, setPreviewGroup] = useState(null);

  // Through the shared screen cache (like every other tab): going back to Home
  // shows the ministries instantly instead of re-downloading them each time.
  // It's refreshed quietly once it's a couple of minutes old, and the Refresh
  // button marks everything stale, so a refresh is still a real fetch.
  // no-store keeps the browser's own HTTP cache out of it.
  const { data: groupsData, loading: groupsLoading } = useResource(HOME_GROUPS.key, HOME_GROUPS.fetcher, {
    staleMs: HOME_GROUPS.staleMs,
  });
  const groups = groupsData || [];

  const membershipByGroupId = Object.fromEntries(
    me.memberships.filter((m) => m.status === "active").map((m) => [m.group_id, m])
  );
  const myGroupIds = new Set(Object.keys(membershipByGroupId));
  const pendingGroupIds = new Set(
    me.memberships.filter((m) => m.status === "pending").map((m) => m.group_id)
  );

  // The result is a toast (announced to screen readers, and visible wherever
  // you're scrolled) -- it used to be a line at the very BOTTOM of the page.
  const requestJoin = async (groupId, name) => {
    try {
      await requestJson(`/api/groups/${groupId}/join-request`, { method: "POST" });
      toast.success(name ? `Request sent to join ${name}. A leader will review it.` : "Join request sent.");
    } catch (err) {
      toast.error(err.message);
    }
    refreshMe(); // either way, show the real state (e.g. "pending")
  };

  const myGroups = groups.filter((g) => myGroupIds.has(g.id) && !g.archived_at);
  // Church Admins get every group back from /api/groups (including hidden
  // ones), so they can find and un-hide them from the Admin Toolbox. But
  // this "Other ministries" browse list is Cam-as-a-member browsing, not
  // Cam-as-admin managing -- a hidden ministry should disappear from here
  // for an admin exactly like it does for anyone else, since management
  // of hidden ministries already has its own dedicated place (Toolbox).
  const otherGroups = groups.filter((g) => !myGroupIds.has(g.id) && !g.hidden && !g.archived_at);
  const listedOtherIds = new Set(otherGroups.map((g) => g.id));
  const pendingNotListed = me.memberships
    .filter((m) => m.status === "pending" && !listedOtherIds.has(m.group_id))
    .map((m) => m.group?.name)
    .filter(Boolean);

  const nextEvent = useNextEvent(me);

  return (
    <div className="px-5 pt-4 pb-6">
      {/* No page title: the highlighted Home button already says where you are,
          and the room lets your ministries show without scrolling. */}
      <h2 className="sr-only">Home</h2>

      {/* Not in any ministry yet: the ministries come first, to ask to join. */}
      {groupsData && myGroupIds.size === 0 && (
        <WelcomeCard me={me} groups={groupsData} pendingGroupIds={pendingGroupIds} onRequestJoin={requestJoin} />
      )}

      <HomeGetStartedCard onGoToTab={onGoToTab} onOpenSettings={onOpenSettings} />

      <VerseOfDayCard onOpenPassage={onOpenPassage} />
      <ThisSundayCard nextEvent={nextEvent} onOpenEvents={() => onGoToTab("calendar")} />
      <AnnouncementsPreview onSeeAll={() => onGoToTab("news")} />
      <MinistryAnnouncements me={me} groups={groupsData} onOpenGroup={onOpenGroup} />
      {/* Not in a ministry yet: no tile grid, so Church Prayer keeps its card. */}
      {groupsData && myGroupIds.size === 0 && <ChurchPrayerCard onOpen={onOpenChurchPrayer} />}

      <div className={`flex items-center justify-between mb-2 ${groupsData && myGroupIds.size === 0 ? "hidden" : ""}`}>
        <p className="text-xs uppercase tracking-wide text-inkfaint">Your ministries</p>
        <button onClick={onOpenDirectory} className="text-xs text-accent underline py-2 -my-2 px-2 -mx-2">Directory</button>
      </div>
      {groupsLoading && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] md:grid-cols-[repeat(auto-fill,minmax(10rem,12rem))] gap-2.5 md:gap-3 mb-2" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-line/60 animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      )}
      {!groupsLoading && groupsData && myGroups.length === 0 && myGroupIds.size > 0 && (
        <p className="text-sm text-inkfaint mb-2">You're not in any ministries yet — request to join one below.</p>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] md:grid-cols-[repeat(auto-fill,minmax(10rem,12rem))] gap-2.5 md:gap-3 mb-2">
        {myGroups.map((g) => (
          <MinistryTile
            key={g.id}
            group={g}
            myRole={membershipByGroupId[g.id]?.role}
            onOpen={() => onOpenGroup(g.id, g.name, membershipByGroupId[g.id]?.role, g.features)}
          />
        ))}
        {myGroups.length > 0 && <ChurchPrayerTile onOpen={onOpenChurchPrayer} />}
      </div>
      {/* Pending requests already show on their row in "Other ministries"; this
          line only covers one that ISN'T listed there (e.g. a hidden ministry),
          so a request is never mentioned twice or missed. */}
      {pendingNotListed.length > 0 && (
        <p className="text-xs text-inkfaint mb-4">{pendingNotListed.join(", ")} — request pending approval.</p>
      )}

      {otherGroups.length > 0 && myGroupIds.size > 0 && (
        <>
          <p className="text-xs uppercase tracking-wide text-inkfaint mt-6 mb-2">Other ministries</p>
          <div className="space-y-1.5">
            {otherGroups.map((g) => (
              <BrowseMinistryRow
                key={g.id}
                group={g}
                leaders={g.leaders}
                isPending={pendingGroupIds.has(g.id)}
                onRequestJoin={() => requestJoin(g.id, g.name)}
                onPreview={() => setPreviewGroup(g)}
              />
            ))}
          </div>
        </>
      )}

      {previewGroup && (
        <MinistryPreview
          group={previewGroup}
          leaders={previewGroup.leaders}
          isPending={pendingGroupIds.has(previewGroup.id)}
          isMember={myGroupIds.has(previewGroup.id)}
          onClose={() => setPreviewGroup(null)}
          onRequestJoin={() => requestJoin(previewGroup.id, previewGroup.name)}
          onLaunch={() => onOpenGroup(previewGroup.id, previewGroup.name, membershipByGroupId[previewGroup.id]?.role, previewGroup.features)}
        />
      )}
    </div>
  );
}
