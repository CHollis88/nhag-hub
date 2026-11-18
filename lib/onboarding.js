"use client";

import { requestJson } from "@/lib/request";
import { detectDevice, isStandalone, INSTALL_DISMISSED_KEY } from "@/lib/installDetect";

// v72 onboarding: the setup walkthrough (new accounts), the "Finish
// setting up" checklist (everyone), and the one-time "What's new" tour.
//
// Choices live on the ACCOUNT (users.onboarding, via /api/me/onboarding) so
// a "No thanks" follows someone between Safari and the installed app (which
// keep separate storage on iPhone); a copy on the phone covers the moment
// before the server answers, and works before migration_041 is run.

export const TOUR_VERSION = "72.0";
const LOCAL_KEY = "nhag_onboarding_local"; // { declined:[], done:[], walkthrough_done, tour_seen }
const NEW_ACCOUNT_DAYS = 14;

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}") || {};
  } catch {
    return {};
  }
}
function writeLocal(patch) {
  try {
    const cur = readLocal();
    const next = { ...cur, ...patch };
    for (const k of ["declined", "done"]) {
      if (patch[k]) next[k] = [...new Set([...(cur[k] || []), ...patch[k]])];
    }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new Event("nhag-onboarding-changed"));
  } catch {
    // ignore
  }
}

/** Account + phone choices, merged. */
export function onboardingState(me) {
  const server = me?.user?.onboarding || {};
  const local = typeof window === "undefined" ? {} : readLocal();
  return {
    declined: new Set([...(server.declined || []), ...(local.declined || [])]),
    done: new Set([...(server.done || []), ...(local.done || [])]),
    walkthroughDone: Boolean(server.walkthrough_done || local.walkthrough_done),
    tourSeen: server.tour_seen === TOUR_VERSION || local.tour_seen === TOUR_VERSION,
  };
}

async function save(body, localPatch) {
  writeLocal(localPatch);
  try {
    await requestJson("/api/me/onboarding", { method: "POST", body });
  } catch {
    // the phone copy still holds it
  }
}
export const declineItem = (id) => save({ decline: id }, { declined: [id] });
export const markItemDone = (id) => save({ done: id }, { done: [id] });
// Finishing the walkthrough also counts as seeing this version's tour: a new
// member has just been shown everything.
export const finishWalkthrough = () =>
  save({ walkthrough_done: true, tour_seen: TOUR_VERSION }, { walkthrough_done: true, tour_seen: TOUR_VERSION });
export const markTourSeen = () => save({ tour_seen: TOUR_VERSION }, { tour_seen: TOUR_VERSION });

function isNewAccount(me) {
  const created = me?.user?.created_at ? new Date(me.user.created_at).getTime() : 0;
  return created > 0 && Date.now() - created < NEW_ACCOUNT_DAYS * 86400000;
}

/** A brand-new account that hasn't been through the walkthrough yet. */
export function shouldShowWalkthrough(me) {
  if (!me?.user) return false;
  return isNewAccount(me) && !onboardingState(me).walkthroughDone;
}

/** Everyone else gets the "What's new" tour once, the first time they open 72.0. */
export function shouldShowTour(me) {
  if (!me?.user) return false;
  if (isNewAccount(me)) return false; // new members get the walkthrough instead
  return !onboardingState(me).tourSeen;
}

/**
 * The checklist. `subscribed` = this device has push turned on.
 * Each item: { id, title, body, done, cta }
 */
export function checklistItems(me, { subscribed = false } = {}) {
  if (!me?.user) return [];
  const st = onboardingState(me);
  const device = typeof window === "undefined" ? { mobile: false, os: "other" } : detectDevice();
  let installed = false;
  try {
    installed = isStandalone() || Boolean(localStorage.getItem(INSTALL_DISMISSED_KEY));
  } catch {
    installed = isStandalone();
  }
  // On iPhone, notifications only work from the home-screen app, so having
  // them on means it's installed.
  if (device.os === "ios" && subscribed) installed = true;
  let biblePicked = st.done.has("bible");
  try {
    biblePicked = biblePicked || Boolean(localStorage.getItem("sp_bible_translation"));
  } catch {
    // ignore
  }

  const all = [
    {
      id: "photo",
      title: "Add a profile photo",
      body: "So people in your ministries know who's who.",
      done: Boolean(me.user.avatar_url),
      cta: "Add photo",
    },
    {
      id: "install",
      title: "Put NHAG on your home screen",
      body: "Open it like any other app.",
      done: installed,
      cta: "Show me how",
      only: device.mobile,
    },
    {
      id: "notifications",
      title: "Turn on notifications",
      body: "Hear about church news, events, and your ministries.",
      done: subscribed,
      cta: "Turn on",
    },
    {
      id: "ministry",
      title: "Join a ministry",
      body: "Choir, Sunday School classes, and more.",
      done: (me.memberships || []).length > 0,
      cta: "See ministries",
    },
    {
      id: "bible",
      title: "Pick your Bible translation",
      body: "KJV, BSB, ESV, NLT, NKJV, or AMP.",
      done: biblePicked,
      cta: "Choose",
    },
  ];
  return all.filter((i) => i.only !== false && !st.declined.has(i.id));
}
