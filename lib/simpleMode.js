// v71 -- Simple mode: an easier version of the same app, for people who'd
// rather not hunt through buttons (older members, first-time smartphone users).
//
// It is a setting of THIS DEVICE, like theme and text size -- not of the account
// -- so a family member or a helper can turn it on once, on the person's own
// phone, and it stays that way (including after they sign out and back in).
//
// It never takes anything away. It shows fewer things at once and explains the
// rest: a shorter bottom bar, a word under every button at the top of the screen,
// bigger labels, messages that stay up longer, and the Bible starting in its
// plainer view. Anything left off the bottom bar is still reachable from Home.
const KEY = "sp_simple_mode";
export const SIMPLE_MODE_EVENT = "sp-simple-mode-change";

// The bottom bar in Simple mode: the five things most people open the app for.
// (Calendar and Directory are still reachable from Home; a tab you are ON is
// always shown, so you never lose track of where you are.)
export const SIMPLE_TAB_KEYS = ["hub", "bible", "news", "events", "sermons"];

export function getSimpleMode() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false; // storage blocked (private mode): behave as normal
  }
}

export function setSimpleMode(on) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // If it can't be saved it can't be kept; the event below still updates this session.
  }
  window.dispatchEvent(new Event(SIMPLE_MODE_EVENT));
}

// Which tabs the bottom bar / sidebar shows. `tabs` is the full list, `current`
// the tab you're on.
export function visibleTabs(tabs, current, simple) {
  if (!simple) return tabs;
  return tabs.filter((t) => SIMPLE_TAB_KEYS.includes(t.key) || t.key === current);
}

// How long a message stays on screen (milliseconds). Someone still reading, or
// reading slowly, shouldn't have "Saved" or an explanation of what went wrong
// vanish under them: Simple mode keeps messages up more than twice as long.
const TOAST_MS = { success: 3000, info: 4000, error: 7000 };
const TOAST_MS_SIMPLE = { success: 8000, info: 10000, error: 15000 };
export function toastDuration(kind, simple = getSimpleMode()) {
  const table = simple ? TOAST_MS_SIMPLE : TOAST_MS;
  return table[kind] || (simple ? 10000 : 4000);
}
