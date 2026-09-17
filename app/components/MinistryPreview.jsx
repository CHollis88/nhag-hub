"use client";

import Image from "next/image";
import { readableTextColor } from "@/lib/colorContrast";

const DEFAULT_TILE_COLOR = "#4A5568";

// Deliberately shows only what's meant to be public -- identity and
// description -- not News/Events/Roster, which stay genuinely
// member-only everywhere else in the app. This isn't a lesser version of
// the real thing; it's the actual public face of a ministry, same idea
// as a church bulletin blurb before you show up to a class.
export default function MinistryPreview({ group, leaders, isPending, onClose, onRequestJoin }) {
  const bg = group.tile_color || DEFAULT_TILE_COLOR;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-[60]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-t-2xl w-full max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex justify-between items-center mb-4 gap-2">
          <h2 className="font-serif text-xl text-ink m-0 min-w-0 truncate">About this ministry</h2>
          <button onClick={onClose} className="text-2xl text-inkfaint leading-none flex-shrink-0">×</button>
        </div>

        <div className="flex flex-col items-center text-center mb-5">
          {group.image_url ? (
            <Image
              src={group.image_url}
              alt=""
              width={80}
              height={80}
              className="w-20 h-20 rounded-xl object-cover mb-3"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-xl flex items-center justify-center font-serif text-3xl mb-3"
              style={{ background: bg, color: readableTextColor(bg) }}
            >
              {group.name?.[0]?.toUpperCase() || "?"}
            </div>
          )}
          <p className="font-serif text-2xl text-ink">{group.name}</p>
          {group.type && <p className="text-sm text-inkfaint mt-0.5">{group.type}</p>}
        </div>

        {group.description ? (
          <p className="text-sm text-inksoft leading-relaxed mb-5 whitespace-pre-wrap">{group.description}</p>
        ) : (
          <p className="text-sm text-inkfaint italic mb-5">No description yet.</p>
        )}

        {leaders?.length > 0 && (
          <div className="mb-5">
            <p className="text-xs uppercase tracking-wide text-inkfaint mb-1.5">
              {leaders.length === 1 ? "Leader" : "Leaders"}
            </p>
            <p className="text-sm text-ink">{leaders.join(", ")}</p>
          </div>
        )}

        {isPending ? (
          <button disabled className="sp-btn-primary w-full opacity-60 cursor-default">
            Request Pending
          </button>
        ) : (
          <button
            onClick={() => {
              onRequestJoin();
              onClose();
            }}
            className="sp-btn-primary w-full"
          >
            Request to Join
          </button>
        )}
      </div>
    </div>
  );
}
