import { FileText, Guitar, FileMusic, Mic2, Headphones } from "lucide-react";

// Single source of truth for "what counts as playable/viewable media on
// a song" -- used by SongsTab (so a tap opens the inline viewer instead
// of leaving the app) and MediaTab (the dedicated browse-all-media
// view). Both group_songs and program_songs share this exact column
// set, so this same list covers Programs' Songs tab too (it's the same
// SongsTab component, just pointed at a different baseUrl).
export const SONG_MEDIA_FIELDS = [
  ["lyrics_url", "Lyrics", FileText],
  ["chords_url", "Chords", Guitar],
  ["sheet_music_url", "Sheet Music", FileMusic],
  ["soprano_url", "Soprano", Mic2],
  ["alto_url", "Alto", Mic2],
  ["tenor_url", "Tenor", Mic2],
  ["bass_url", "Bass", Mic2],
  ["split_track_url", "Split Track", Mic2],
  ["demo_url", "Demo", Headphones],
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
