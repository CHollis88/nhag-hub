// v71 #13 -- unsaved journal text, kept on THIS device until the server
// confirms it.
//
// A journal entry is the one thing in the app that is pure personal writing
// -- retyping it is not an option. So every keystroke is mirrored here, and
// the entry only leaves this store once a save has actually succeeded. If a
// save fails (offline, signed out, server error), or the app is closed
// mid-thought, the text is still here the next time that day is opened.
//
// Scoped by user ID (so someone else signing in on the same phone never
// sees it) and by plan and day (so days never overwrite each other).
// Everything is removed at sign-out (clearAllJournalDrafts).
//
// Every call is wrapped: storage can be unavailable (private mode, quota).
// In that case drafts simply aren't kept; nothing else changes.

const PREFIX = "sp_journal_draft:";
const keyFor = (userId, planId, day) => `${PREFIX}${userId}:${planId}:${day}`;

export function readDraft(userId, planId, day) {
  try {
    if (!userId) return null;
    const raw = localStorage.getItem(keyFor(userId, planId, day));
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.text === "string" ? parsed.text : null;
  } catch {
    return null;
  }
}

export function writeDraft(userId, planId, day, text) {
  try {
    if (!userId) return;
    localStorage.setItem(keyFor(userId, planId, day), JSON.stringify({ text, at: Date.now() }));
  } catch {
    // Storage unavailable/full -- the server save is still attempted.
  }
}

export function clearDraft(userId, planId, day) {
  try {
    if (!userId) return;
    localStorage.removeItem(keyFor(userId, planId, day));
  } catch {
    // ignore
  }
}

// Called at sign-out: nothing personal stays behind on a shared device.
export function clearAllJournalDrafts() {
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
