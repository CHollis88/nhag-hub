"use client";

import { useEffect, useState, useCallback } from "react";

// Fixed 5-emoji set (mirrors MessageReactions' 4-emoji pattern, plus 😢
// for prayer/grief content). Self-contained: fetches and toggles its
// own reactions given only a postType + postId, so any post list can
// drop this in without wiring its own fetch/toggle logic.
const ALLOWED_EMOJI = ["👍", "❤️", "🙏", "😂", "😢"];

export default function PostReactions({ postType, postId }) {
  const [reactions, setReactions] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/posts/${postType}/${postId}/reactions`);
    if (res.ok) {
      const data = await res.json();
      setReactions(data.reactions);
    }
  }, [postType, postId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (emoji) => {
    // Optimistic: flip mine/count locally, then reconcile.
    setReactions((prev) => {
      const list = prev || [];
      const existing = list.find((r) => r.emoji === emoji);
      if (existing) {
        const nextCount = existing.mine ? existing.count - 1 : existing.count + 1;
        if (nextCount <= 0 && existing.mine) return list.filter((r) => r.emoji !== emoji);
        return list.map((r) => (r.emoji === emoji ? { ...r, count: nextCount, mine: !r.mine } : r));
      }
      return [...list, { emoji, count: 1, mine: true }];
    });
    setPickerOpen(false);
    await fetch(`/api/posts/${postType}/${postId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    load();
  };

  return (
    <div className="flex items-center gap-1 flex-wrap mt-2">
      {reactions?.map((r) => (
        <button
          key={r.emoji}
          onClick={() => toggle(r.emoji)}
          className={`text-[0.6875rem] leading-none rounded-full px-1.5 py-1 border shadow-sm bg-card ${
            r.mine ? "border-accent" : "border-line"
          }`}
        >
          {r.emoji} {r.count}
        </button>
      ))}
      <div className="relative">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="text-[0.6875rem] leading-none rounded-full px-1.5 py-1 border border-line text-inkfaint bg-card"
        >
          + React
        </button>
        {pickerOpen && (
          <div className="absolute z-10 top-full left-0 mt-1 flex gap-1 bg-card border border-line rounded-full px-2 py-1 shadow-sm">
            {ALLOWED_EMOJI.map((emoji) => (
              <button key={emoji} onClick={() => toggle(emoji)} className="text-sm px-0.5">
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
