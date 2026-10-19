// The "mini player" setting is a preference of THIS DEVICE (like text size), so
// it needs no database column. OFF by default: music stops when you leave the
// playlist screen. Turned on in Settings, it keeps playing and shows a small bar.
const KEY = "nhag_mini_player"; // "on" = enabled, anything else / missing = off
export const MINI_PLAYER_EVENT = "nhag-mini-player-change";

export function getMiniPlayerEnabled() {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function setMiniPlayerEnabled(on) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch { /* storage blocked: the change just won't persist */ }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MINI_PLAYER_EVENT));
}
