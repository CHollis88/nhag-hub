import { FileText, Guitar, FileMusic, Mic2, Headphones } from "lucide-react";

// Third element is the media type: "pdf" fields replace what's showing
// in the main viewer; "audio" fields keep playing in the background
// even while a pdf is being viewed, so switching to Lyrics doesn't cut
// off a track that's mid-play.
export const SONG_MEDIA_FIELDS = [
  ["lyrics_url", "Lyrics", FileText, "pdf"],
  ["chords_url", "Chords", Guitar, "pdf"],
  ["sheet_music_url", "Sheet Music", FileMusic, "pdf"],
  ["soprano_url", "Soprano", Mic2, "audio"],
  ["alto_url", "Alto", Mic2, "audio"],
  ["tenor_url", "Tenor", Mic2, "audio"],
  ["bass_url", "Bass", Mic2, "audio"],
  ["split_track_url", "Split Track", Mic2, "audio"],
  ["demo_url", "Demo", Headphones, "audio"],
];

// Shared across both helpers below -- a Drive file's ID is the one
// thing both the preview iframe URL and the proxy route need.
function extractDriveFileId(url) {
  const match = url?.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  return match ? match[1] : null;
}

// Drive's own /preview endpoint renders a native player for whatever
// the file actually is -- a PDF viewer for PDFs, an audio player UI
// for audio files -- so the same iframe embed works for every field
// here without needing to know the real content type ourselves. Only
// works for drive.google.com/file/d/<ID>/... links; anything else
// (someone pasted a non-Drive link) falls back to a plain "Open" link.
export function toEmbedUrl(url) {
  const id = extractDriveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

// Points at the app's own /api/drive-media proxy (see that route's
// comment), which streams the file server-side using Drive API v3's
// `alt=media` -- the real, supported way to get a public file's raw
// bytes, unlike the old `uc?export=download` link this used to point
// at (which turned out to reliably serve Google's HTML "can't scan for
// viruses" page instead of the file, breaking playback immediately).
// Requires GOOGLE_DRIVE_API_KEY to be set on the server; if it's
// missing or the proxy request fails for any reason, the caller
// (NativeAudioPlayer) falls back to toEmbedUrl()'s iframe automatically.
export function toDirectDownloadUrl(url) {
  const id = extractDriveFileId(url);
  return id ? `/api/drive-media/${id}` : null;
}
