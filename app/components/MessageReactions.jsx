"use client";

import { useState } from "react";

// Fixed 4-emoji set per Cam's decision -- no open picker. Shown as small
// pill counts under a message; tapping one you've already used removes
// it (toggle), tapping a fresh one adds it. Tap-to-open picker rather
// than hover, since this is a phone-first PWA with no hover state.
const EMOJI_SET = ["👍", "❤️", "🙏", "😂"];

export default function MessageReactions({ reactions, currentUserId, onToggle }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const counts = {};
  const mine = new Set();
  for (const r of reactions || []) {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    if (r.user_id === currentUserId) mine.add(r.emoji);
  }

  const used = EMOJI_SET.filter((e) => counts[e] > 0);

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap relative">
      {used.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onToggle(emoji)}
          className={`text-xs rounded-full px-1.5 py-0.5 border ${
            mine.has(emoji) ? "border-accent bg-accent/10" : "border-linesoft"
          }`}
        >
          {emoji} {counts[emoji]}
        </button>
      ))}
      <button
        onClick={() => setPickerOpen((o) => !o)}
        className="text-xs text-inkfaint px-1.5 py-0.5 rounded-full border border-linesoft"
      >
        +
      </button>
      {pickerOpen && (
        <div className="absolute bottom-full left-0 mb-1 bg-card border border-line rounded-lg shadow-lg p-1 flex gap-1 z-10">
          {EMOJI_SET.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onToggle(emoji);
                setPickerOpen(false);
              }}
              className="text-base p-1 active:bg-paper rounded"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
