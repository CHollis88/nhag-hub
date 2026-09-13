"use client";

import { X } from "lucide-react";

export default function StudyPopup({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-card w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-5 max-h-[70vh] overflow-y-auto"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-serif text-lg text-ink">{title}</p>
          <button onClick={onClose} className="text-inkfaint">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
