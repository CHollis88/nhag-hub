"use client";

// v72 "New" badges: a small pill on features people may not have found
// yet (Church Prayer, profile photos, NKJV/AMP). Each shows for two weeks
// from the first time this phone opens 72.0, and goes away for good once
// the person has opened that feature.

const START_KEY = "nhag_new_since_72";
const SEEN_KEY = "nhag_new_seen";
const DAYS = 14;

function start() {
  try {
    let s = Number(localStorage.getItem(START_KEY) || 0);
    if (!s) {
      s = Date.now();
      localStorage.setItem(START_KEY, String(s));
    }
    return s;
  } catch {
    return Date.now();
  }
}

function seen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function isNewFeature(id) {
  if (typeof window === "undefined") return false;
  if (Date.now() > start() + DAYS * 86400000) return false;
  return !seen().has(id);
}

export function markFeatureSeen(id) {
  if (typeof window === "undefined") return;
  try {
    const s = seen();
    if (s.has(id)) return;
    s.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
  } catch {
    // ignore
  }
}
