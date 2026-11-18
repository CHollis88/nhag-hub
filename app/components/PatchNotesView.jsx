"use client";

import { useState } from "react";
import { PATCH_NOTES } from "@/lib/patchNotes";
import Modal from "./Modal";

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

export default function PatchNotesView({ onClose, onTakeTour }) {
  return (
    <Modal title="What's New" onClose={onClose} z={60} maxHeight="85vh">
      {/* v72: rerun the "What's new" tour any time (it shows once per device). */}
      {onTakeTour && (
        <button type="button" onClick={onTakeTour} className="w-full mb-4 bg-accent text-white rounded-xl py-3 text-sm font-semibold">
          Take the tour of what&apos;s new
        </button>
      )}
      {PATCH_NOTES.map((entry, i) => (
        <Entry key={entry.date} entry={entry} defaultOpen={i === 0} />
      ))}
    </Modal>
  );
}
