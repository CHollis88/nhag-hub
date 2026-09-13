"use client";

import { useEffect, useState, useCallback } from "react";
import HomeGetStartedCard from "./HomeGetStartedCard";

const DEFAULT_TILE_COLOR = "#4A5568";

function MinistryTile({ group, leaders, myRole, onLaunch, onRequestJoin }) {
  const isMember = Boolean(myRole);
  const bg = group.tile_color || DEFAULT_TILE_COLOR;

  return (
    <div className="sp-card p-0 overflow-hidden">
      <div className="h-2" style={{ background: bg }} />
      <div className="p-4 flex items-center gap-3">
        {group.image_url ? (
          <img src={group.image_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div
            className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-serif text-xl"
            style={{ background: bg }}
          >
            {group.name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-serif text-base text-ink truncate">{group.name}</p>
          {group.type && <p className="text-xs text-inkfaint truncate">{group.type}</p>}
          {leaders?.length > 0 && (
            <p className="text-xs text-inkfaint truncate">
              {leaders.length === 1 ? "Leader: " : "Leaders: "}
              {leaders.join(", ")}
            </p>
          )}
          {isMember && <p className="text-xs text-inkfaint">{myRole === "leader" ? "Ministry Leader" : "Member"}</p>}
        </div>
        {isMember ? (
          <button onClick={onLaunch} className="sp-btn-pill flex-shrink-0">Launch</button>
        ) : (
          <button onClick={onRequestJoin} className="sp-btn-secondary text-xs py-1.5 px-3 flex-shrink-0">
            Join
          </button>
        )}
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
export default function HomeTab({ me, refreshMe, onOpenGroup, onGoToTab, onOpenSettings }) {
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

      <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Your ministries</p>
      {myGroups.length === 0 && (
        <p className="text-sm text-inkfaint mb-2">You're not in any ministries yet — request to join one below.</p>
      )}
      <div className="space-y-2 mb-2">
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
          <div className="space-y-2">
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
