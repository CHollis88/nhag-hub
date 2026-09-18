"use client";

import { useEffect, useState, useCallback } from "react";
import HomeGetStartedCard from "./HomeGetStartedCard";
import MinistryPreview from "./MinistryPreview";
import { readableTextColor } from "@/lib/colorContrast";
import { formatTime12h } from "@/lib/formatTime";

const DEFAULT_TILE_COLOR = "#4A5568";
const CHURCH_WIDE_COLOR = "#16296B"; // same brand navy used for "Church-wide" everywhere else (Calendar)

function MinistryTile({ group, leaders, myRole, isPending, onLaunch, onRequestJoin, onPreview }) {
  const isMember = Boolean(myRole);
  const bg = group.tile_color || DEFAULT_TILE_COLOR;

  return (
    <div className="sp-card p-0 overflow-hidden flex flex-col h-full">
      <div className="h-2 flex-shrink-0" style={{ background: bg }} />
      <div
        className="p-3 md:p-5 lg:p-6 flex flex-col items-center text-center flex-1"
        onClick={onPreview}
        role="button"
      >
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
          >
            {group.name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <p className="font-serif text-base md:text-xl lg:text-2xl text-ink leading-snug break-words">{group.name}</p>
        {/* Everything below is hidden on mobile (the compact, icon-and-name-
            first view Cam asked for) and only shown from md: up -- on a
            phone, tapping the tile itself opens the full preview instead,
            where the type, leaders, and description are all still there. */}
        {group.type && <p className="hidden md:block text-xs md:text-sm text-inkfaint break-words mt-0.5">{group.type}</p>}
        {leaders?.length > 0 && (
          <p className="hidden md:block text-xs md:text-sm text-inkfaint break-words mt-0.5">
            {leaders.length === 1 ? "Leader: " : "Leaders: "}
            {leaders.join(", ")}
          </p>
        )}
        {isMember && (
          <p className="hidden md:block text-xs md:text-sm text-inkfaint mt-0.5">
            {myRole === "leader" ? "Ministry Leader" : "Member"}
          </p>
        )}
        {!isMember && group.description && (
          <p className="hidden md:block text-xs md:text-sm text-inksoft mt-1.5 line-clamp-2">{group.description}</p>
        )}

        <div className="mt-auto pt-3 md:pt-4 w-full" onClick={(e) => e.stopPropagation()}>
          {isMember ? (
            <button onClick={onLaunch} className="sp-btn-pill w-full md:text-base md:py-2">Launch</button>
          ) : isPending ? (
            // Disabled on purpose -- a second tap here used to silently
            // re-send the same join request and get rejected by the
            // server (already-pending, 409) with no visual cue beforehand
            // that one was already sent. This makes the already-pending
            // state visible instead of indistinguishable from "not yet
            // requested."
            <button
              disabled
              onClick={(e) => e.stopPropagation()}
              className="sp-btn-secondary text-xs py-1.5 w-full opacity-60 cursor-default"
            >
              Pending
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRequestJoin();
              }}
              className="sp-btn-secondary text-xs py-1.5 w-full"
            >
              Join
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Deliberately a different shape from MinistryTile above -- a compact,
// muted row rather than a full card -- so browsing ministries you're NOT
// in never looks visually identical to (or as prominent as) the ones
// you're actually part of. Per Cam's decision, this distinction matters:
// "your ministries" are what you launch into daily; "other ministries" is
// just discovery, so it should read as secondary at a glance.
function BrowseMinistryRow({ group, leaders, isPending, onRequestJoin, onPreview }) {
  const bg = group.tile_color || DEFAULT_TILE_COLOR;

  return (
    <div
      className="flex items-center gap-3 bg-paper border border-linesoft rounded-lg px-3 py-2.5 opacity-90"
      onClick={onPreview}
      role="button"
    >
      {group.image_url ? (
        <img src={group.image_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 grayscale-[30%]" />
      ) : (
        <div
          className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center font-serif text-sm opacity-80"
          style={{ background: bg, color: readableTextColor(bg) }}
        >
          {group.name?.[0]?.toUpperCase() || "?"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-inksoft truncate">{group.name}</p>
        {leaders?.length > 0 && (
          <p className="text-xs text-inkfaint truncate">{leaders.join(", ")}</p>
        )}
      </div>
      {isPending ? (
        <span className="text-xs text-inkfaint flex-shrink-0 opacity-70">Pending</span>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRequestJoin();
          }}
          className="text-xs text-accent underline flex-shrink-0"
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

    Promise.all([
      fetch("/api/global/events").then((r) => r.json()),
      ...myGroups.map((m) => fetch(`/api/groups/${m.group_id}/events`).then((r) => r.json())),
    ]).then(([globalRes, ...groupResults]) => {
      const today = new Date().toISOString().slice(0, 10);

      const globalEvents = (globalRes.events || []).map((ev) => ({
        ...ev,
        sourceName: "Church-wide",
        color: CHURCH_WIDE_COLOR,
      }));
      const groupEvents = myGroups.flatMap((m, i) =>
        (groupResults[i]?.events || []).map((ev) => ({
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
  const [message, setMessage] = useState("");
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

  const requestJoin = async (groupId) => {
    setMessage("");
    const res = await fetch(`/api/groups/${groupId}/join-request`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? "Join request sent." : data.error);
    refreshMe();
  };

  const myGroups = groups.filter((g) => myGroupIds.has(g.id));
  // Church Admins get every group back from /api/groups (including hidden
  // ones), so they can find and un-hide them from the Admin Toolbox. But
  // this "Other ministries" browse list is Cam-as-a-member browsing, not
  // Cam-as-admin managing -- a hidden ministry should disappear from here
  // for an admin exactly like it does for anyone else, since management
  // of hidden ministries already has its own dedicated place (Toolbox).
  const otherGroups = groups.filter((g) => !myGroupIds.has(g.id) && !g.hidden);

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
            onLaunch={() => onOpenGroup(g.id, g.name, membershipByGroupId[g.id]?.role, g.features)}
            onPreview={() => setPreviewGroup(g)}
          />
        ))}
      </div>
      {me.memberships.some((m) => m.status === "pending") && (
        <p className="text-xs text-inkfaint mb-4">
          {me.memberships.filter((m) => m.status === "pending").map((m) => m.group?.name).join(", ")}{" "}
          — request pending approval.
        </p>
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
                onRequestJoin={() => requestJoin(g.id)}
                onPreview={() => setPreviewGroup(g)}
              />
            ))}
          </div>
        </>
      )}

      {message && <p className="text-sm text-inksoft mt-3">{message}</p>}

      {previewGroup && (
        <MinistryPreview
          group={previewGroup}
          leaders={previewGroup.leaders}
          isPending={pendingGroupIds.has(previewGroup.id)}
          isMember={myGroupIds.has(previewGroup.id)}
          onClose={() => setPreviewGroup(null)}
          onRequestJoin={() => requestJoin(previewGroup.id)}
          onLaunch={() => onOpenGroup(previewGroup.id, previewGroup.name, membershipByGroupId[previewGroup.id]?.role, previewGroup.features)}
        />
      )}
    </div>
  );
}
