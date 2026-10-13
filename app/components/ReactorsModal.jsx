"use client";

import Modal from "./Modal";

// v71_16 -- "who reacted". Takes a list of { emoji, names: [..] } and shows each
// emoji with the people who picked it. Shared by News/Prayer posts and by Chat
// and Messages, which only differ in where the names come from.
export default function ReactorsModal({ groups, onClose }) {
  return (
    <Modal title="Who reacted" onClose={onClose} width="popup" z={70}>
      {groups.length === 0 ? (
        <p className="text-sm text-inkfaint">No reactions yet.</p>
      ) : (
        <ul className="space-y-3 list-none p-0 m-0">
          {groups.map(({ emoji, names }) => (
            <li key={emoji} className="flex items-start gap-3">
              <span className="text-xl leading-none mt-0.5" aria-hidden="true">{emoji}</span>
              <span className="text-sm text-ink">
                <span className="sr-only">{emoji} </span>
                {names.join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

// Turns flat [{ emoji, name }] rows (Chat / Messages) into the grouped shape.
export function groupReactors(rows) {
  const byEmoji = new Map();
  for (const r of rows || []) {
    if (!byEmoji.has(r.emoji)) byEmoji.set(r.emoji, []);
    byEmoji.get(r.emoji).push(r.name);
  }
  return [...byEmoji.entries()].map(([emoji, names]) => ({ emoji, names }));
}
