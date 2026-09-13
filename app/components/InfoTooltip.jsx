"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

export default function InfoTooltip({ text }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block align-middle ml-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-inkfaint align-middle"
        aria-label="More info"
      >
        <HelpCircle size={13} />
      </button>
      {open && (
        <span className="absolute z-20 left-1/2 -translate-x-1/2 top-full mt-1.5 w-56 bg-card border border-line rounded-lg px-3 py-2 text-xs text-inksoft leading-snug shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}
