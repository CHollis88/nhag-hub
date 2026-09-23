"use client";

import { ExternalLink } from "lucide-react";
import { toEmbedUrl } from "@/lib/songMedia";

/**
 * Renders Sheet Music/Lyrics/Chords (PDF or Word doc) via Google
 * Drive's own /preview embed.
 *
 * This used to be a custom PDF.js (canvas) + docx-preview (shadow DOM)
 * renderer, built for a nicer in-app look with our own page navigation
 * and zoom. After several rounds of chasing a real, hard browser-level
 * crash tied to that custom canvas rendering (not just a catchable JS
 * error -- an actual page/renderer crash on some devices, which kept
 * recurring in new forms after each attempted fix and eventually
 * started happening on a plain PDF open with no other interaction),
 * the custom renderer was reverted in favor of this simpler, proven
 * approach. Google's own preview is less visually integrated, but it's
 * reliable -- for a real app people depend on, that trade wins.
 *
 * If a more polished in-app viewer is worth revisiting later, it
 * should happen with real device/console access to diagnose the
 * canvas crash properly, not another remote guess-and-patch cycle.
 */
export default function NativeDocViewer({ url }) {
  const embedUrl = toEmbedUrl(url);

  if (embedUrl) {
    return <iframe src={embedUrl} className="w-full h-full border-0" allow="autoplay" />;
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-inkfaint">This link can't be previewed inline.</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="sp-btn-secondary flex items-center gap-1.5">
        Open <ExternalLink size={13} />
      </a>
    </div>
  );
}
