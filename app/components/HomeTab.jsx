"use client";

import { useEffect, useState, useCallback } from "react";
import HomeGetStartedCard from "./HomeGetStartedCard";
import MinistryPreview from "./MinistryPreview";
import { readableTextColor } from "@/lib/colorContrast";
import { formatTime12h } from "@/lib/formatTime";
import { todayLocal } from "@/lib/localDate";
import { requestJson } from "@/lib/request";
import { useToast } from "./ToastProvider";

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
function MinistryTile({ group, leaders, myRole, onOpen }) {
  const bg = group.tile_color || DEFAULT_TILE_COLOR;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${group.name}`}
      className="sp-card p-0 overflow-hidden flex flex-col h-full w-full text-left"
    >
      <div className="h-2 flex-shrink-0 w-full" style={{ background: bg }} />
      <div className="p-3 md:p-5 lg:p-6 flex flex-col items-center text-center flex-1 w-full">
        {group.image_url ? (
          <img
            src={group.image_url}
            alt=""
            className="w-14 h-14 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-xl object-cover flex-shrink-0 mb-2 md:mb-3"
          />
        ) : (
          <div
            className="w-14 h-14 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-xl flex-shrink-0 flex items-center justify-center font-serif text-xl md:text-3xl lg:text-4xl mb-2 md:mb-3"
            style={{ background: bg, color: readableTextColor(bg) }}
            aria-hidden="true"
          >
            {group.name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <span className="font-serif text-base md:text-xl lg:text-2xl text-ink leading-snug break-words">{group.name}</span>
        {/* Below: hidden on a phone (the compact, icon-and-name-first view),
            shown from md: up. */}
        {group.type && <span className="hidden md:block text-xs md:text-sm text-inkfaint break-words mt-0.5">{group.type}</span>}
        {leaders?.length > 0 && (
          <span className="hidden md:block text-xs md:text-sm text-inkfaint break-words mt-0.5">
            {leaders.length === 1 ? "Leader: " : "Leaders: "}
            {leaders.join(", ")}
          </span>
        )}
        <span className="hidden md:block text-xs md:text-sm text-inkfaint mt-0.5">
          {myRole === "leader" ? "Ministry Leader" : "Member"}
        </span>
        <span aria-hidden="true" className="sp-btn-pill w-full md:text-base md:py-2 mt-auto block text-center">
          Open
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
        <span className="text-xs text-inkfaint flex-shrink-0 px-2">Request pending</span>
      ) : (
        <button
          type="button"
          onClick={onRequestJoin}
          aria-label={`Request to join ${group.name}`}
          className="sp-btn-secondary text-xs px-3 min-h-[44px] flex-shrink-0"
        >
          Request to Join
        </button>
      )}
    </div>
  );
}

function UpcomingEventsPreview({ me, onSeeAll }) {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    const myGroups = (me?.memberships || []).filter((m) => m.status === "active");

    // One request for church-wide + all my ministries' events (v71 #1).
    fetch("/api/events/mine")
      .then((r) => r.json())
      .then((mine) => {
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

      const combined = [...globalEvents, ...groupEvents]
        .filter((e) => e.event_date >= today)
        .sort((a, b) => {
          if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
          return (a.event_time || "99:99").localeCompare(b.event_time || "99:99");
        })
        .slice(0, 1);

      setEvents(combined);
    });
  }, [me]);

  if (events === null || events.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs uppercase tracking-wide text-inkfaint">Your Next Event</p>
        <button onClick={onSeeAll} className="text-xs text-accent underline">See all</button>
      </div>
      <div className="space-y-2">
        {events.map((ev) => (
          <div
            key={`${ev.sourceName}-${ev.id}`}
            className="flex items-center gap-3 bg-card border border-line rounded-lg pl-0 pr-3 py-2.5 overflow-hidden"
          >
            <span className="w-1.5 self-stretch flex-shrink-0" style={{ background: ev.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-ink text-sm truncate">{ev.title}</p>
                <span className="text-[0.625rem] text-inkfaint flex-shrink-0">{ev.sourceName}</span>
              </div>
              <p className="text-xs text-inkfaint">
                {new Date(ev.event_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                {ev.event_time && ` · ${formatTime12h(ev.event_time)}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnnouncementsPreview({ onSeeAll }) {
  const [news, setNews] = useState(null);

  useEffect(() => {
    fetch("/api/global/news")
      .then((r) => r.json())
      .then((data) => setNews((data.news || []).slice(0, 1)));
  }, []);

  if (news === null || news.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs uppercase tracking-wide text-inkfaint">Latest Announcement</p>
        <button onClick={onSeeAll} className="text-xs text-accent underline">See all</button>
      </div>
      <div className="space-y-2">
        {news.map((n) => (
          <div key={n.id} className="sp-card">
            <p className="font-medium text-ink text-sm">{n.title}</p>
            <p className="text-xs text-inksoft line-clamp-2">{n.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Home: the church-wide dashboard. Previews upcoming events and
// announcements, then shows every ministry as a tile (icon, tile color,
// leader names) -- yours to Launch into, others to request joining.
// Everything admin-only lives in the separate Admin Toolbox below.
export default function HomeTab({ me, refreshMe, onOpenGroup, onGoToTab, onOpenSettings, onOpenDirectory }) {
  const [groups, setGroups] = useState([]);
  const toast = useToast();
  const [previewGroup, setPreviewGroup] = useState(null);

  const loadGroups = useCallback(async () => {
    // no-store: this fires every time HomeTab mounts, including every
    // time the refresh button remounts it -- a refresh has to be a real
    // network hit, not risk being served from a 30s browser cache of a
    // slightly-earlier response.
    const res = await fetch("/api/groups", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setGroups(data.groups);
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

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

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-4">Home</h2>

      <HomeGetStartedCard onGoToTab={onGoToTab} onOpenSettings={onOpenSettings} />

      <UpcomingEventsPreview me={me} onSeeAll={() => onGoToTab("calendar")} />
      <AnnouncementsPreview onSeeAll={() => onGoToTab("news")} />

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wide text-inkfaint">Your ministries</p>
        <button onClick={onOpenDirectory} className="text-xs text-accent underline">Directory</button>
      </div>
      {myGroups.length === 0 && (
        <p className="text-sm text-inkfaint mb-2">You're not in any ministries yet — request to join one below.</p>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] md:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3 mb-2">
        {myGroups.map((g) => (
          <MinistryTile
            key={g.id}
            group={g}
            leaders={g.leaders}
            myRole={membershipByGroupId[g.id]?.role}
            onOpen={() => onOpenGroup(g.id, g.name, membershipByGroupId[g.id]?.role, g.features)}
          />
        ))}
      </div>
      {/* Pending requests already show on their row in "Other ministries"; this
          line only covers one that ISN'T listed there (e.g. a hidden ministry),
          so a request is never mentioned twice or missed. */}
      {pendingNotListed.length > 0 && (
        <p className="text-xs text-inkfaint mb-4">{pendingNotListed.join(", ")} — request pending approval.</p>
      )}

      {otherGroups.length > 0 && (
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
