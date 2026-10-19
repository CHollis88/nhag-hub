"use client";

import { useMemo, useState } from "react";
import QueuePlayer from "./QueuePlayer";
import { listenParts, buildQueue } from "@/lib/listenQueue";

// v71_17 -- "Listen by part" on a setlist: ONE part (Alto, Split Track, a custom
// track...) for every song in the setlist, in order. A song without that part
// plays its Split Track, then its Demo; a custom track a song doesn't have is
// skipped (rules in lib/listenQueue.js). The player itself is QueuePlayer.
// The part chips, shared with the program Playlist tab. Each says how many songs
// have a real track of that part, and how many more will play via the fallback.
export function PartChips({ parts, partId, onPick }) {
  return (
    <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Choose a part">
      {parts.map((p) => {
        const active = p.id === partId;
        const detail = !p.custom && p.fallback > 0 ? `${p.own} of ${p.total}, +${p.fallback} use Split Track/Demo` : `${p.own} of ${p.total}`;
        return (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            aria-pressed={active}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 ${
              active ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
            }`}
          >
            {p.label} <span className="font-normal opacity-80">· {detail}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ListenByPartModal({ title, songs, onClose }) {
  const parts = useMemo(() => listenParts(songs), [songs]);
  const [partId, setPartId] = useState(() => (parts.find((p) => p.id === "split_track_url") || parts[0])?.id || null);
  const part = parts.find((p) => p.id === partId) || null;
  const { items, skipped } = useMemo(() => (part ? buildQueue(songs, part) : { items: [], skipped: [] }), [songs, part]);

  if (parts.length === 0) {
    return (
      <QueuePlayer
        items={[]}
        title={title}
        onClose={onClose}
        controls={<p className="text-sm text-inkfaint text-center">None of the songs in this setlist have a track linked yet.</p>}
      />
    );
  }

  return (
    <QueuePlayer
      items={items}
      skipped={skipped}
      skippedPrefix={`Skipped, nothing to play for ${part?.label}:`}
      title={title}
      onClose={onClose}
      controls={<PartChips parts={parts} partId={partId} onPick={setPartId} />}
    />
  );
}
