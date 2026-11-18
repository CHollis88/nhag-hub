"use client";

// Android Chrome (and Samsung Internet) fire "beforeinstallprompt" when the
// app can be installed with one tap. It fires early -- often before React
// is running -- so a tiny script in app/layout.js catches it first and
// parks it on window.__nhagInstallEvent; this module picks it up from there
// (and listens for later ones). iPhone never fires it.

let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(Boolean(deferred)));

if (typeof window !== "undefined") {
  if (window.__nhagInstallEvent) deferred = window.__nhagInstallEvent;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    window.__nhagInstallEvent = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    window.__nhagInstallEvent = null;
    window.__nhagInstalled = true;
    notify();
  });
}

/** Can we show Android's own one-tap install box right now? */
export function canPromptInstall() {
  return Boolean(deferred);
}

/** Subscribe to changes (returns an unsubscribe function). */
export function onInstallPromptChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Show Android's "Install NHAG?" box. Must be called from a tap.
 * @returns {"accepted"|"dismissed"|"unavailable"}
 */
export async function promptInstall() {
  const e = deferred;
  if (!e) return "unavailable";
  deferred = null; // a prompt can only be used once
  window.__nhagInstallEvent = null;
  notify();
  try {
    await e.prompt();
    const choice = await e.userChoice;
    return choice?.outcome === "accepted" ? "accepted" : "dismissed";
  } catch {
    return "unavailable";
  }
}
