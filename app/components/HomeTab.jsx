"use client";

import { useEffect, useState, useCallback } from "react";
import HomeGetStartedCard from "./HomeGetStartedCard";
import { readableTextColor } from "@/lib/colorContrast";

const DEFAULT_TILE_COLOR = "#4A5568";

function MinistryTile({ group, leaders, myRole, onLaunch, onRequestJoin }) {
  const isMember = Boolean(myRole);
  const bg = group.tile_color || DEFAULT_TILE_COLOR;

  return (
    <div className="sp-card p-0 overflow-hidden flex flex-col h-full">
      <div className="h-2 flex-shrink-0" style={{ background: bg }} />
      <div className="p-4 md:p-5 lg:p-6 flex flex-col items-center text-center flex-1">
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
        {group.type && <p className="text-xs md:text-sm text-inkfaint break-words mt-0.5">{group.type}</p>}
        {leaders?.length > 0 && (
          <p className="text-xs md:text-sm text-inkfaint break-words mt-0.5">
            {leaders.length === 1 ? "Leader: " : "Leaders: "}
            {leaders.join(", ")}
          </p>
        )}
        {isMember && (
          <p className="text-xs md:text-sm text-inkfaint mt-0.5">
            {myRole === "leader" ? "Ministry Leader" : "Member"}
          </p>
        )}
        {!isMember && group.description && (
          <p className="text-xs md:text-sm text-inksoft mt-1.5 line-clamp-2">{group.description}</p>
        )}

        <div className="mt-auto pt-3 md:pt-4 w-full">
          {isMember ? (
            <button onClick={onLaunch} className="sp-btn-pill w-full md:text-base md:py-2">Launch</button>
          ) : (
            <button onClick={onRequestJoin} className="sp-btn-secondary text-xs py-1.5 w-full">
              Join
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function UpcomingEventsPreview({ onSeeAll }) {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    fetch("/api/global/events")
      .then((r) => r.json())
      .then((data) => {
        const today = new Date().toISOString().slice(0, 10);
        setEvents((data.events || []).filter((e) => e.event_date >= today).slice(0, 3));
      });
  }, []);

  if (events === null || events.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs uppercase tracking-wide text-inkfaint">Upcoming Events</p>
        <button onClick={onSeeAll} className="text-xs text-accent underline">See all</button>
      </div>
      <div className="space-y-2">
        {events.map((ev) => (
          <div key={ev.id} className="sp-card">
            <p className="font-medium text-ink text-sm">{ev.title}</p>
            <p className="text-xs text-inkfaint">
              {new Date(ev.event_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              {ev.event_time && ` · ${ev.event_time}`}
            </p>
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
      .then((data) => setNews((data.news || []).slice(0, 3)));
  }, []);

  if (news === null || news.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs uppercase tracking-wide text-inkfaint">Announcements</p>
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

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
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

  const requestJoin = async (groupId) => {
    setMessage("");
    const res = await fetch(`/api/groups/${groupId}/join-request`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? "Join request sent." : data.error);
    refreshMe();
  };

  const myGroups = groups.filter((g) => myGroupIds.has(g.id));
  const otherGroups = groups.filter((g) => !myGroupIds.has(g.id));

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-4">Home</h2>

      <HomeGetStartedCard onGoToTab={onGoToTab} onOpenSettings={onOpenSettings} />

      <UpcomingEventsPreview onSeeAll={() => onGoToTab("events")} />
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] md:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3">
            {otherGroups.map((g) => (
              <MinistryTile
                key={g.id}
                group={g}
                leaders={g.leaders}
                myRole={null}
                onRequestJoin={() => requestJoin(g.id)}
              />
            ))}
          </div>
        </>
      )}

      {message && <p className="text-sm text-inksoft mt-3">{message}</p>}
    </div>
  );
}
