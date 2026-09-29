"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { requestJson } from "@/lib/request";
import { useToast } from "./ToastProvider";

// Fixed 5-emoji set (mirrors MessageReactions' 4-emoji pattern, plus 😢
// for prayer/grief content). Self-contained: fetches and toggles its
// own reactions given only a postType + postId, so any post list can
// drop this in without wiring its own fetch/toggle logic.
const ALLOWED_EMOJI = ["👍", "❤️", "🙏", "😂", "😢"];

export default function PostReactions({ postType, postId }) {
  const [reactions, setReactions] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const busyRef = useRef(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const data = await requestJson(`/api/posts/${postType}/${postId}/reactions`);
      setReactions(data.reactions);
    } catch {
      // Reactions are decoration; a failed load just shows none.
    }
  }, [postType, postId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (emoji) => {
    // Ignore a second tap while one is in flight -- two toggles in a row
    // (a double tap) used to undo each other.
    if (busyRef.current) return;
    busyRef.current = true;
    const before = reactions;
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
    try {
      await requestJson(`/api/posts/${postType}/${postId}/reactions`, { method: "POST", body: { emoji } });
    } catch (err) {
      setReactions(before); // put it back exactly as it was, and say why
      toast.error(err.message);
      busyRef.current = false;
      return;
    }
    busyRef.current = false;
    load();
  };

  return (
    <div className="flex items-center gap-1 flex-wrap mt-2">
      {reactions?.map((r) => (
        <button
          key={r.emoji}
          onClick={() => toggle(r.emoji)}
          aria-pressed={Boolean(r.mine)}
          aria-label={`${r.emoji} ${r.count}${r.mine ? ", you reacted" : ""}`}
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
