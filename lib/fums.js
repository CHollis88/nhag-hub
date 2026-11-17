"use client";

// API.Bible's Fair Use Management System (FUMS): web apps that show
// API.Bible Scripture must report each time it's shown. The server passes
// along the token API.Bible gave it; this sends it straight from the
// browser to fums.api.bible as a one-pixel image request -- no app
// server, Vercel or Supabase cost, and nothing personal is sent: the
// device and session IDs are random and stay on this phone.
//
// The same chapter shown twice in a row (re-render, tab switch) is
// reported once.

const DEVICE_KEY = "nhag_fums_device";
const SESSION_KEY = "nhag_fums_session";
let lastSent = "";

function randomId() {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

function stored(storage, key) {
  try {
    let v = storage.getItem(key);
    if (!v) {
      v = randomId();
      storage.setItem(key, v);
    }
    return v;
  } catch {
    return randomId();
  }
}

export function reportFums(token, viewKey = "") {
  if (!token || typeof window === "undefined") return;
  const once = `${token}|${viewKey}`;
  if (once === lastSent) return;
  lastSent = once;
  try {
    const dId = stored(localStorage, DEVICE_KEY);
    const sId = stored(sessionStorage, SESSION_KEY);
    const url =
      "https://fums.api.bible/f3?" +
      new URLSearchParams({ t: token, dId, sId, uId: dId }).toString();
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.src = url;
  } catch {
    // tracking must never break reading
  }
}
