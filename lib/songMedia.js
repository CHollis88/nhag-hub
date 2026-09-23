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

// Drive's own /preview endpoint renders a native player for whatever
// the file actually is -- a PDF viewer for PDFs, an audio player UI
// for audio files -- so the same iframe embed works for every field
// here without needing to know the real content type ourselves. Only
// works for drive.google.com/file/d/<ID>/... links; anything else
// (someone pasted a non-Drive link) falls back to a plain "Open" link.
export function toEmbedUrl(url) {
  const match = url?.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (!match) return null;
  return `https://drive.google.com/file/d/${match[1]}/preview`;
}

// A direct-download link serves the raw file bytes, which is what lets
// a real <audio> element play it with custom controls instead of
// embedding Google's own player UI. This isn't a documented, supported
// Google API for this purpose -- it can fail on some files (very large
// ones especially, where Drive shows an interstitial "can't scan for
// viruses" page instead of the file) -- so callers should always be
// ready to fall back to toEmbedUrl() if playback errors out.
export function toDirectDownloadUrl(url) {
  const match = url?.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (!match) return null;
  return `https://drive.google.com/uc?export=download&id=${match[1]}`;
}
