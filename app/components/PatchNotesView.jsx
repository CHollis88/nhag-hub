"use client";

import { useState } from "react";
import { PATCH_NOTES } from "@/lib/patchNotes";

function Entry({ entry, defaultOpen }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="border-b border-linesoft py-3">
      <button onClick={() => setOpen(!open)} className="w-full text-left">
        <p className="text-xs text-inkfaint">
          {new Date(entry.date + "T00:00:00").toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          {entry.version && ` · v${entry.version}`}
        </p>
        <p className="font-semibold text-[0.9375rem] text-ink mt-0.5">{entry.title}</p>
      </button>
      {open && (
        <ul className="mt-2 text-sm text-inksoft list-disc pl-5 space-y-1.5">
          {entry.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PatchNotesView({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-[60]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-t-2xl w-full max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex justify-between items-center mb-2 gap-2">
          <h2 className="font-serif text-xl text-ink m-0 min-w-0 truncate">What's New</h2>
          <button onClick={onClose} className="text-2xl text-inkfaint leading-none flex-shrink-0">×</button>
        </div>
        {PATCH_NOTES.map((entry, i) => (
          <Entry key={entry.date} entry={entry} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}
