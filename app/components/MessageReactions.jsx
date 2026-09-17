"use client";

// Fixed 4-emoji set per Cam's decision. Renders as small pills that
// overlap the message bubble's bottom corner (GroupMe-style) instead of
// sitting on their own line below it. Tapping a pill toggles YOUR
// reaction of that emoji off if you're already in it, on if you're not
// -- the trigger for adding a NEW reaction (one not already on the
// message) is the long-press picker in MessageThreadView, not this
// component.
export default function MessageReactions({ reactions, currentUserId, onToggle, alignRight }) {
  const counts = {};
  const mine = new Set();
  for (const r of reactions || []) {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    if (r.user_id === currentUserId) mine.add(r.emoji);
  }

  const used = Object.keys(counts);
  if (!used.length) return null;

  return (
    <div
      className={`absolute -bottom-2.5 flex gap-0.5 ${alignRight ? "right-1" : "left-1"}`}
    >
      {used.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onToggle(emoji)}
          className={`text-[0.6875rem] leading-none rounded-full px-1.5 py-1 border shadow-sm bg-card ${
            mine.has(emoji) ? "border-accent" : "border-line"
          }`}
        >
          {emoji} {counts[emoji]}
        </button>
      ))}
    </div>
  );
}
