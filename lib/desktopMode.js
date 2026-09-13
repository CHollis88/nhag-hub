const KEY = "sp_bible_desktop_mode";

export function getDesktopMode() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "on";
}

export function setDesktopMode(on) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, on ? "on" : "off");
  window.dispatchEvent(new Event("sp-desktop-mode-change"));
}
