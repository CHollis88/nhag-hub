"use client";

import { ExternalLink } from "lucide-react";
import { toDirectDownloadUrl } from "@/lib/songMedia";

/**
 * Renders a PDF (Lyrics, Chords, Sheet Music) through the app's own
 * /api/drive-media proxy -- same one NativeAudioPlayer uses -- instead
 * of Google's /preview iframe directly. Browsers have a built-in
 * native PDF viewer that kicks in automatically for any iframe pointed
 * at a URL serving `Content-Type: application/pdf`, so this needs no
 * PDF library of its own, just the right URL.
 *
 * No fallback logic lives here -- the proxy route itself redirects to
 * Google's /preview page on any failure (missing API key, a file
 * that's not actually public, etc.), so a plain iframe pointed at the
 * proxy already degrades gracefully on its own. The only case handled
 * here is a url that isn't a Drive link at all, which never reaches
 * the proxy in the first place.
 */
export default function NativePdfViewer({ url }) {
  const directUrl = toDirectDownloadUrl(url);

  if (!directUrl) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-inkfaint">This link can't be previewed inline.</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="sp-btn-secondary flex items-center gap-1.5">
          Open <ExternalLink size={13} />
        </a>
      </div>
    );
  }

  return <iframe src={directUrl} className="w-full h-full border-0" />;
}
