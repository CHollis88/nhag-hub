"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { readableTextColor } from "@/lib/colorContrast";
import EmptyState from "./EmptyState";
import { SkeletonList } from "./Skeleton";
import MemberProfileModal from "./MemberProfileModal";

const DEFAULT_TILE_COLOR = "#4A5568";

function DirectoryEntry({ group, leaders, isMember }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState(null);
  const [profileUserId, setProfileUserId] = useState(null);
  const bg = group.tile_color || DEFAULT_TILE_COLOR;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    // Only fetch the full roster if you're actually a member -- the
    // members endpoint itself would 403 otherwise, same privacy rule as
    // everywhere else in the app. For ministries you're not in, the
    // leaders already shown (from /api/groups) are all that's shown.
    if (next && isMember && members === null) {
      const res = await fetch(`/api/groups/${group.id}/members`);
      const data = await res.json();
      if (res.ok) setMembers(data.active);
    }
  };

  return (
    <div className="sp-card p-0 overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center gap-3 p-3 text-left">
        {group.image_url ? (
          <Image
            src={group.image_url}
            alt=""
            width={40}
            height={40}
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center font-serif text-sm"
            style={{ background: bg, color: readableTextColor(bg) }}
          >
            {group.name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-serif text-sm text-ink truncate">{group.name}</p>
          {leaders?.length > 0 && (
            <p className="text-xs text-inkfaint truncate">
              {leaders.length === 1 ? "Leader: " : "Leaders: "}
              {leaders.join(", ")}
            </p>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-inkfaint flex-shrink-0" /> : <ChevronDown size={16} className="text-inkfaint flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-linesoft pt-2">
          {group.description && <p className="text-sm text-inksoft mb-2">{group.description}</p>}
          {!isMember ? (
            <p className="text-xs text-inkfaint">Join this ministry to see its full roster.</p>
          ) : members === null ? (
            <p className="text-xs text-inkfaint">Loading…</p>
          ) : (
            <div className="space-y-1">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setProfileUserId(m.users?.id)}
                  className="text-sm text-inksoft text-left block w-full hover:underline"
                >
                  {m.users?.display_name}
                  {m.role === "leader" && <span className="text-inkfaint text-xs"> · Leader</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {profileUserId && <MemberProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />}
    </div>
  );
}

export default function DirectoryView({ me, onClose }) {
  const [groups, setGroups] = useState(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/groups");
    const data = await res.json();
    if (res.ok) setGroups(data.groups);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const myGroupIds = new Set(me.memberships.filter((m) => m.status === "active").map((m) => m.group_id));

  // /api/groups returns every group unfiltered to a Church Admin (so the
  // Admin Toolbox can find and un-hide one) -- but the Directory is a
  // browsing view like any member's, so a hidden ministry should stay out
  // of it here too unless the viewer is already a member of it.
  const visibleGroups = useMemo(
    () => (groups || []).filter((g) => !g.hidden || myGroupIds.has(g.id)),
    [groups, myGroupIds]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return visibleGroups;
    const q = query.toLowerCase();
    return visibleGroups.filter(
      (g) => g.name.toLowerCase().includes(q) || (g.leaders || []).some((l) => l.toLowerCase().includes(q))
    );
  }, [visibleGroups, query]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-[60]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-t-2xl w-full max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex justify-between items-center mb-2 gap-2">
          <h2 className="font-serif text-xl text-ink m-0 min-w-0 truncate">Directory</h2>
          <button onClick={onClose} className="text-2xl text-inkfaint leading-none flex-shrink-0">×</button>
        </div>
        <p className="text-sm text-inksoft mb-4">
          Every ministry's leaders, church-wide. Tap one to see its full roster if you're a member —
          otherwise just its leaders are shown.
        </p>

        {groups !== null && visibleGroups.length > 3 && (
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ministries or leaders..."
              className="sp-input pl-9"
            />
          </div>
        )}

        {groups === null && <SkeletonList count={4} />}
        {visibleGroups.length > 0 && filtered.length === 0 && (
          <EmptyState icon={Search} text="No ministries match that search." />
        )}
        <div className="space-y-2">
          {filtered.map((g) => (
            <DirectoryEntry key={g.id} group={g} leaders={g.leaders} isMember={myGroupIds.has(g.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
