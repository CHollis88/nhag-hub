"use client";

import { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { SONG_MEDIA_FIELDS, toEmbedUrl } from "@/lib/songMedia";

// Full-screen inline viewer/player -- shared by SongsTab (tapping a
// link button on a song) and MediaTab (browsing all songs' media), so
// there's exactly one place this behavior lives. Works identically for
// Choir's main library and every Program's song library, since both
// just pass a `song` object with the same field shape.
export default function MediaViewerModal({ song, initialField, onClose }) {
  const [activeField, setActiveField] = useState(initialField);

  const available = SONG_MEDIA_FIELDS.filter(([key]) => song[key]);
  const activeUrl = activeField ? song[activeField] : null;
  const embedUrl = activeUrl ? toEmbedUrl(activeUrl) : null;

  return (
    <div className="fixed inset-0 bg-card z-[80] flex flex-col">
      <div className="flex justify-between items-center gap-2 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 border-b border-linesoft flex-shrink-0">
        <h3 className="font-serif text-lg text-ink m-0 min-w-0 truncate">{song.title}</h3>
        <button onClick={onClose} className="text-inkfaint flex-shrink-0 p-1" aria-label="Close">
          <X size={22} />
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap px-4 py-3 flex-shrink-0">
        {available.map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setActiveField(key)}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 flex items-center gap-1 ${
              activeField === key ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 bg-paper">
        {embedUrl ? (
          <iframe src={embedUrl} className="w-full h-full border-0" allow="autoplay" />
        ) : activeUrl ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-inkfaint">This link can't be previewed inline.</p>
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sp-btn-secondary flex items-center gap-1.5"
            >
              Open <ExternalLink size={13} />
            </a>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-inkfaint">Nothing linked yet for this song.</p>
          </div>
        )}
      </div>
    </div>
  );
}
