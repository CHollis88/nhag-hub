// The song columns a playlist entry may point at: the audio tracks only
// (never lyrics / chords / sheet music). Shared by the playlist routes and the
// Playlist tab so the two can never disagree about what a track key is.
export const PLAYLIST_TRACK_KEYS = [
  "demo_url",
  "split_track_url",
  "soprano_url",
  "alto_url",
  "tenor_url",
  "bass_url",
  "extra1_url",
  "extra2_url",
  "extra3_url",
];

export const MAX_PLAYLISTS_PER_PROGRAM = 20;
export const MAX_ITEMS_PER_PLAYLIST = 200;
export const MAX_PLAYLIST_NAME = 60;
