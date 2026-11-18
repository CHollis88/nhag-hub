"use client";

import HeaderButton from "./components/HeaderButton";
import { useSimpleMode } from "@/lib/useSimpleMode";
import { setCacheUser, clearResourceCache, forget, invalidate, fetchResource } from "@/lib/resourceCache";
import { HOME_RESOURCES } from "@/lib/homeData";
import { warmSettings, warmNotifications, warmAdminToolbox } from "@/lib/screenData";
import { useEffect, useState, useCallback, useRef, Suspense, useSyncExternalStore, useMemo } from "react";
import { OPEN_ORIGIN_EVENT } from "@/lib/nowWhere";
import { OPEN_BIBLE_EVENT } from "./components/ReadAloudBar";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import BottomNav from "./components/BottomNav";
import Sidebar from "./components/Sidebar";
// HomeTab stays a static import: it's the default tab, shown on first paint,
// so lazy-loading it would just trade an instant render for a loading flash.
import HomeTab from "./components/HomeTab";
import TabSkeleton from "./components/TabSkeleton";
import TabTransition from "./components/TabTransition";
import NotifyBanner, { shouldShowNotifyBanner } from "./components/NotifyBanner";
import InstallGuide from "./components/InstallGuide";
import DesktopInstallTip from "./components/DesktopInstallTip";
import SetupWalkthrough from "./components/SetupWalkthrough";
import WhatsNewTour from "./components/WhatsNewTour";
import BiblePickerSheet from "./components/BiblePickerSheet";
import { shouldShowWalkthrough, shouldShowTour } from "@/lib/onboarding";
import { subscribeToPush } from "@/lib/pushClient";
import { shouldAutoShowInstallGuide, detectDevice, isStandalone } from "@/lib/installDetect";

// Everything below here is only ever shown after a tab switch or an explicit
// open action, so it's a code-splitting candidate: keeps it out of the initial
// JS bundle and loads it the first time it's actually needed.
// `Lazy` is the normal next/dynamic version of the same screen (Next needs
// each dynamic() written out literally), used until the code is here.
function preloadable(importer, Lazy) {
  let Loaded = null;
  const load = () =>
    importer().then((m) => {
      Loaded = m.default;
      return m;
    });
  function Screen(props) {
    // Chosen once per opening: if the background download finishes while
    // this screen is already open, it must NOT be swapped for the other
    // version (that would restart it and lose what you were doing).
    const [Component] = useState(() => Loaded || Lazy);
    return <Component {...props} />;
  }
  Screen.preload = () => load().catch(() => {});
  return Screen;
}
const NewsTab = preloadable(() => import("./components/NewsTab"), dynamic(() => import("./components/NewsTab"), { loading: () => <TabSkeleton /> }));
const EventsTab = preloadable(() => import("./components/EventsTab"), dynamic(() => import("./components/EventsTab"), { loading: () => <TabSkeleton /> }));
const BibleTab = preloadable(() => import("./components/BibleTab"), dynamic(() => import("./components/BibleTab"), { loading: () => <TabSkeleton /> }));
const SermonsTab = preloadable(() => import("./components/SermonsTab"), dynamic(() => import("./components/SermonsTab"), { loading: () => <TabSkeleton /> }));
const CalendarTab = preloadable(() => import("./components/CalendarTab"), dynamic(() => import("./components/CalendarTab"), { loading: () => <TabSkeleton /> }));
// While the ministry screen's code is still downloading, show the same navy
// cover the opening transition uses, so tapping a ministry is seamless.
// Once the code has been fetched (it is, quietly, right after sign-in), the
// screen is rendered directly instead of through the lazy loader -- the lazy
// path always shows its placeholder for ~0.3s first, even when the code is
// already here, which made opening a ministry feel sluggish.
//
// The same goes for every other screen below: right after launch their code
// is fetched quietly in the background (preloadScreens), so Settings, Help,
// Notifications, the tabs, etc. open instantly instead of downloading their
// code -- and showing a placeholder -- the first time each is opened.
// (Static files from the CDN, kept by the phone: no server functions.)
const GroupShellScreen = preloadable(() => import("./components/GroupShell"), dynamic(() => import("./components/GroupShell"), {
  loading: () => <div className="nhag-welcome fixed inset-0 z-[70]" aria-hidden="true" />,
}));
const SettingsView = preloadable(() => import("./components/SettingsView"), dynamic(() => import("./components/SettingsView")));
const HelpView = preloadable(() => import("./components/HelpView"), dynamic(() => import("./components/HelpView")));
const PatchNotesView = preloadable(() => import("./components/PatchNotesView"), dynamic(() => import("./components/PatchNotesView")));
const AttributionView = preloadable(() => import("./components/AttributionView"), dynamic(() => import("./components/AttributionView")));
const AdminToolboxView = preloadable(() => import("./components/AdminToolboxView"), dynamic(() => import("./components/AdminToolboxView")));
const DirectoryView = preloadable(() => import("./components/DirectoryView"), dynamic(() => import("./components/DirectoryView")));
const NotificationsView = preloadable(() => import("./components/NotificationsView"), dynamic(() => import("./components/NotificationsView")));
const ChurchPrayerView = preloadable(() => import("./components/ChurchPrayerView"), dynamic(() => import("./components/ChurchPrayerView")));
const ProfileView = preloadable(() => import("./components/ProfileView"), dynamic(() => import("./components/ProfileView")));

let screensPreloaded = false;
function preloadScreens(isAdmin) {
  // One after another, so this never competes with what the person is doing.
  const screens = [GroupShellScreen, BibleTab, EventsTab, NewsTab, CalendarTab, SermonsTab, SettingsView, NotificationsView, DirectoryView, ProfileView, HelpView, PatchNotesView, AttributionView, ChurchPrayerView];
  if (isAdmin) screens.push(AdminToolboxView);
  screens.reduce((chain, screen) => chain.then(() => screen.preload()), Promise.resolve());
}
import { Bell, Settings, Wrench, UserCircle, LogOut, KeyRound, HelpCircle, RotateCw, Menu } from "lucide-react";
import { hasNewContent, markSeen } from "@/lib/lastSeen";
import { PATCH_NOTES } from "@/lib/patchNotes";
import { useKeyboardVisible } from "@/lib/useKeyboardVisible";
import { useViewportHeight } from "@/lib/useViewportHeight";
import { requestJson } from "@/lib/request";
import { clearAllJournalDrafts } from "@/lib/journalDrafts";
import { useToast } from "./components/ToastProvider";
import PullToRefresh from "./components/PullToRefresh";
import { markNotificationsReadFor, setUnreadForAutoRead, onUnreadChanged } from "@/lib/notifyRead";

// The welcome screen: the cross from the church logo while the app gets
// ready. It is in the very first HTML the phone receives (the Suspense
// fallback below), so there's never a blank screen at launch, and it stays up
// while the app checks who you are and loads Home -- so Home appears complete
// instead of popping in piece by piece.
// Launch state for the welcome screen. The welcome screen is ONE element that
// is on screen from the very first HTML until the app is ready: it sits
// OUTSIDE the Suspense boundary below, so it is never swapped for a second
// copy partway through launch (that swap restarted its animation and made
// the app look like it loaded twice).
const boot = { visible: true, failed: false, retry: null };
const bootListeners = new Set();
function setBoot(patch) {
  Object.assign(boot, patch);
  bootListeners.forEach((fn) => fn());
}
let bootSnapshot = { ...boot };
function subscribeBoot(fn) {
  bootListeners.add(fn);
  return () => bootListeners.delete(fn);
}
function getBootSnapshot() {
  if (bootSnapshot.visible !== boot.visible || bootSnapshot.failed !== boot.failed || bootSnapshot.retry !== boot.retry) {
    bootSnapshot = { ...boot };
  }
  return bootSnapshot;
}
const SERVER_BOOT = { visible: true, failed: false, retry: null };

function BootSplash() {
  const state = useSyncExternalStore(subscribeBoot, getBootSnapshot, () => SERVER_BOOT);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (state.visible) {
      setGone(false);
      return undefined;
    }
    const t = setTimeout(() => setGone(true), 260); // after the fade-out
    return () => clearTimeout(t);
  }, [state.visible]);
  if (gone) return null;
  return (
    <div className={`fixed inset-0 z-[80] nhag-boot nhag-welcome ${state.visible ? "" : "is-out"}`}>
      <WelcomeScreen failed={state.failed} onRetry={() => state.retry?.()} />
    </div>
  );
}

function WelcomeScreen({ failed = false, onRetry }) {
  return (
    <div className="nhag-welcome min-h-[100dvh] h-full flex flex-col items-center justify-center p-6 text-center">
      <img
        src="/splash-emblem.webp"
        alt=""
        width={467}
        height={841}
        fetchPriority="high"
        className="nhag-welcome-emblem w-[5.5rem] h-auto mb-6"
      />
      <p className="font-serif text-white text-xl tracking-wide">North Hodge</p>
      <p className="text-white/60 text-xs uppercase tracking-[0.25em] mt-1">Assembly of God</p>
      <div className="mt-8 min-h-[5.5rem] max-w-xs" aria-live="polite">
        {failed ? (
          <>
            <p className="text-white/90 text-sm font-medium mb-1">Having trouble connecting</p>
            <p className="text-white/60 text-xs mb-4">
              Trying again… If you're on Wi-Fi (especially a public one), try switching to cellular.
            </p>
            <button onClick={onRetry} className="text-sm font-semibold rounded-full px-5 py-2 bg-white text-navydeep">Try now</button>
          </>
        ) : (
          <>
            <div className="nhag-welcome-bar mx-auto" aria-hidden="true" />
            <span className="sr-only">Loading</span>
          </>
        )}
      </div>
    </div>
  );
}

function AuthCard({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-navydeep">
      <div className="max-w-[420px] w-full p-8 rounded-2xl text-center bg-card shadow-2xl">
        <img
          src="/icon-192.png"
          alt="North Hodge Assembly of God"
          className="w-24 h-24 mx-auto mb-4 block rounded-xl"
        />
        {children}
      </div>
    </div>
  );
}

function EmailLinkForm({ onSent }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestJson("/api/auth/request-link", { method: "POST", body: { email } });
      onSent(email);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="sp-input mb-3"
      />
      <button type="submit" disabled={loading} className="sp-btn-primary w-full">
        {loading ? "Sending…" : "Send me a sign-in link"}
      </button>
      {error && <p className="text-sm mt-3 text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}

// PIN is the primary, day-to-day sign-in -- it works identically in any
// browser context, including an already-installed iOS home-screen app,
// where a magic link cannot reach (Safari and an installed PWA have
// separate, isolated storage on iOS, by Apple's design). Email is only
// ever offered as the secondary path: first-time setup, or recovering a
// forgotten PIN.
function SignInScreen({ authError }) {
  const [mode, setMode] = useState("pin"); // "pin" | "email"
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(authError || "");
  const [loading, setLoading] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState(null);

  const submitPin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestJson("/api/auth/pin-login", { method: "POST", body: { username, pin } });
      window.location.href = "/";
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (emailSentTo) {
    return (
      <AuthCard>
        <h2 className="font-serif text-xl text-ink mb-2">Check your email</h2>
        <p className="text-sm text-inksoft">
          We sent a sign-in link to <strong className="text-ink">{emailSentTo}</strong>. Click it
          to continue — it expires in 15 minutes.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h2 className="font-serif text-xl text-ink mb-0.5">North Hodge Assembly of God</h2>
      <p className="text-inkfaint text-sm mt-0 mb-4">Sign in to continue</p>

      {mode === "pin" ? (
        <>
          <form onSubmit={submitPin}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoCapitalize="none"
              required
              className="sp-input mb-3"
            />
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="PIN"
              inputMode="numeric"
              required
              className="sp-input mb-3"
            />
            <button type="submit" disabled={loading} className="sp-btn-primary w-full">
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
          {error && <p className="text-sm mt-3 text-red-600 dark:text-red-400">{error}</p>}
          <button onClick={() => { setMode("email"); setError(""); }} className="text-xs text-accent underline mt-4">
            First time here, or forgot your PIN?
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-inksoft mb-4">
            Enter your email — we'll send a link to sign in and set (or reset) your PIN.
          </p>
          <EmailLinkForm onSent={setEmailSentTo} />
          <button onClick={() => { setMode("pin"); setError(""); }} className="text-xs text-accent underline mt-4">
            ← Back to PIN sign-in
          </button>
        </>
      )}
    </AuthCard>
  );
}

function AppShell({ me, refreshMe, onSignOut, deepLink }) {
  const [tab, setTab] = useState("hub");
  // Opening a main tab clears notifications about it (e.g. "/?tab=sermons").
  useEffect(() => {
    if (tab && tab !== "hub") markNotificationsReadFor(`/?tab=${tab}`);
  }, [tab]);
  // Bumped by the refresh button (below) to force the current tab to
  // remount -- refetching its data from scratch and replaying the
  // tab-fade-in transition -- without a full location.reload(), which
  // would needlessly throw away the app shell/bundle that's already
  // loaded and cached.
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [latestContent, setLatestContent] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [patchNotesOpen, setPatchNotesOpen] = useState(false);
  const [attributionOpen, setAttributionOpen] = useState(false);
  const [adminToolboxOpen, setAdminToolboxOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showNotifyBanner, setShowNotifyBanner] = useState(false);
  // v71.29: the "Install on your Home Screen" guide is the first thing anyone
  // using the app in a phone's browser sees (never in the installed app).
  // (AppShell only ever renders in the browser, after sign-in, so these can
  // be decided right away instead of in an effect.)
  const [installOpen, setInstallOpenRaw] = useState(() => shouldAutoShowInstallGuide());
  const setInstallOpen = (v) => {
    setInstallOpenRaw(v);
    if (!v) window.dispatchEvent(new Event("nhag-onboarding-changed")); // checklist re-checks
  };
  // v72: after the install guide (if any), a brand-new account gets the
  // setup walkthrough; everyone else gets the "What's new" tour, once.
  const [intro, setIntro] = useState(null); // null | "walkthrough" | "tour"
  const introDecided = useRef(false);
  useEffect(() => {
    if (installOpen || introDecided.current) return;
    introDecided.current = true;
    if (shouldShowWalkthrough(me)) setIntro("walkthrough");
    else if (shouldShowTour(me)) setIntro("tour");
  }, [installOpen, me]);
  const [biblePickerOpen, setBiblePickerOpen] = useState(false);
  // The tour's "Try it now" pauses it on that card; it comes back once the
  // screen it opened (Church Prayer, Edit Profile, the Bible picker) closes.
  const [tourPausedAt, setTourPausedAt] = useState(null);
  const tourTargetOpened = useRef(false);
  const [profileViewOpen, setProfileViewOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // A screen clearing its own notifications updates the bell badge.
  useEffect(() => onUnreadChanged(setUnreadCount), []);
  // v71 #19: `is_church_admin` from the server is EFFECTIVE (the admin role
  // AND this device's "Use Admin Privileges" switch). The old client-only
  // preference is gone -- what you see now is what the server will allow.
  const [adminAttention, setAdminAttention] = useState(0); // Toolbox "Needs attention" count
  const simple = useSimpleMode(); // v71: Simple mode (a per-device setting)
  const toast = useToast();
  const isAdmin = me.user.is_church_admin;
  // Hides the bottom tab bar while an on-screen keyboard is open, same
  // reasoning as GroupShell's own use of this hook -- keeps it from
  // getting squeezed up alongside whatever's focused (a search field, a
  // form input) when the keyboard opens.
  const keyboardVisible = useKeyboardVisible();
  // Real, live-updating viewport height -- see the hook itself for why
  // h-dvh alone isn't a reliable stand-in for this on mobile.
  const viewportHeight = useViewportHeight();

  // Register the service worker once on load -- without this, push
  // notifications can never arrive: there's nothing installed in the
  // browser to receive a push event and actually show it, regardless of
  // whether the subscription/VAPID setup is otherwise correct.
  //
  // Also actively asks the browser to check for a newer service worker
  // right away (rather than waiting on the browser's own, more
  // throttled update schedule), and reloads once a new one actually
  // takes over. Without this, a tab left open across a deploy can keep
  // running an old cached JS bundle for a while -- exactly the kind of
  // thing that would make a just-shipped fix (like notification click
  // routing) seem to work "sometimes" depending on whether a given
  // device happened to pick up the update yet.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.update().catch(() => {}))
      .catch(() => {});

    // Only reload when a NEW version replaces an OLD one. On a phone's very
    // first visit there's no old version, and reloading then just made the
    // app load twice for nothing.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;
    const onControllerChange = () => {
      // Also not during launch: a page that has just opened was fetched
      // fresh from the network (pages are network-first), so it IS the new
      // version already -- reloading it again was the "loads twice" right
      // after an update. Only a screen left open across an update reloads.
      if (!hadController || reloaded || performance.now() < 15000) return;
      reloaded = true;
      // Loop guard: never auto-reload more than once a minute, whatever the
      // service worker does. A device that kept reloading made the app flash
      // and become unusable.
      try {
        const last = Number(sessionStorage.getItem("nhag_sw_reload_at") || 0);
        if (Date.now() - last < 60000) return;
        sessionStorage.setItem("nhag_sw_reload_at", String(Date.now()));
      } catch {}
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  // Prompt for push a moment after landing, same delay YA uses -- gives
  // the page a beat to settle before asking, rather than an instant
  // permission dialog on load.
  useEffect(() => {
    if (shouldShowNotifyBanner()) {
      const t = setTimeout(() => setShowNotifyBanner(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  // Notifications must stay accurate in real time -- not just on first
  // load. Three ways this now stays fresh:
  //  1. Poll every 45s while the tab is visible (paused in the
  //     background so we're not burning requests/battery on a hidden tab).
  //  2. Refetch immediately the moment the tab becomes visible again
  //     (covers "I backgrounded the app for 10 minutes, came back").
  //  3. Refetch immediately when the service worker tells us a push just
  //     arrived (see the postMessage in public/sw.js) -- so the badge
  //     updates the instant something happens, not up to 45s later.
  // v71 #1: ONE call returns both the "new content" timestamps and the
  // unread count (it used to be two calls -- /latest and the full 50-row
  // notifications list -- every 45 seconds).
  // Anything newly posted must show up right away, whatever the screen cache
  // holds. This cheap "what's newest?" check already runs on a timer, when
  // the app comes back to the front, and when a push arrives; if it sees
  // something newer than last time (a post, an event, a sermon, or a new
  // notification), every cached screen is marked out of date and whatever is
  // on screen reloads now. A tapped push opens the app fresh anyway.
  const lastLatestRef = useRef(null);
  const refreshNotifications = useCallback(() => {
    fetch("/api/notifications/latest")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        const prev = lastLatestRef.current;
        lastLatestRef.current = data;
        const newer = (k) => data[k] && (!prev?.[k] || data[k] > prev[k]);
        if (prev && (newer("news") || newer("events") || newer("sermons") || (data.unread_count ?? 0) > (prev.unread_count ?? 0))) {
          invalidate(() => true);
        }
        setLatestContent(data);
        if (typeof data.unread_count === "number") {
          setUnreadCount(data.unread_count);
          setUnreadForAutoRead(data.unread_count);
        }
        // Present only for an effective admin (v71 #22); absent otherwise.
        setAdminAttention(typeof data.admin_attention_count === "number" ? data.admin_attention_count : 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshNotifications();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refreshNotifications();
    }, 90000); // v71.29: was 45s. New posts still arrive instantly by push.

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshNotifications();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const onSwMessage = (event) => {
      if (event.data?.type === "NEW_NOTIFICATION") {
        // A push just arrived while the app is open: refresh what's on screen
        // and mark everything else out of date, so the new post shows at once.
        invalidate(() => true);
        refreshNotifications();
      }
    };
    navigator.serviceWorker?.addEventListener?.("message", onSwMessage);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      navigator.serviceWorker?.removeEventListener?.("message", onSwMessage);
    };
  }, [refreshNotifications]);

  const badges = latestContent
    ? {
        news: hasNewContent("news", latestContent.news),
        events: hasNewContent("events", latestContent.events),
        sermons: hasNewContent("sermons", latestContent.sermons),
      }
    : {};

  // Switching to a tab that had a "new" dot marks it seen, clearing the
  // dot -- same idea as any app's unread-badge behavior. Passed anywhere
  // setTab would otherwise go, so every entry point into a top-level tab
  // (bottom nav, sidebar, Home's own internal links) behaves the same way.
  const switchTab = (nextTab) => {
    markSeen(nextTab);
    setTab(nextTab);
  };
  // v72: where "Show me" / "Try it" buttons go (Did-you-know tips, the
  // What's-new tour).
  const goTo = (where) => {
    if (!where) return;
    if (where === "church-prayer") setChurchPrayerOpen(true);
    else if (where === "profile") setProfileViewOpen(true);
    else if (where === "bible-picker") setBiblePickerOpen(true);
    else if (where === "settings") setSettingsOpen(true);
    else if (where === "help") setHelpOpen(true);
    else if (where === "install") setInstallOpen(true);
    else if (where === "home") {
      switchTab("hub");
      document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
    } else switchTab(where);
  };

  // The "Finish setting up" checklist's buttons: each goes straight to the spot.
  const onboardingAction = async (id) => {
    if (id === "photo") setProfileViewOpen(true);
    else if (id === "install") setInstallOpen(true);
    else if (id === "bible") setBiblePickerOpen(true);
    else if (id === "ministry") {
      const el = document.getElementById("other-ministries") || document.getElementById("welcome-card");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (id === "notifications") {
      // iPhone in a browser: notifications need the home-screen app first.
      if (detectDevice().os === "ios" && !isStandalone()) {
        setInstallOpen(true);
        return;
      }
      const r = await subscribeToPush();
      if (r.ok) toast.success("Notifications on. Choose what you hear about in Settings.");
      else if (r.reason === "denied") toast.error("Notifications are blocked for this app. You can allow them in your phone's settings.");
      else toast.error("This browser can't turn on notifications.");
      window.dispatchEvent(new Event("nhag-onboarding-changed"));
    }
  };


  const [activeGroup, setActiveGroup] = useState(null); // { id, name, role, features } | null
  const [bibleOverlay, setBibleOverlay] = useState(null); // { book, chapter } | null
  const [churchPrayerOpen, setChurchPrayerOpen] = useState(false);
  useEffect(() => {
    if (tourPausedAt === null || intro) return;
    const targetOpen = churchPrayerOpen || profileViewOpen || biblePickerOpen;
    if (targetOpen) tourTargetOpened.current = true;
    else if (tourTargetOpened.current) {
      tourTargetOpened.current = false;
      setIntro("tour");
    }
  }, [tourPausedAt, intro, churchPrayerOpen, profileViewOpen, biblePickerOpen]);
  // The header's Profile button shows your photo once you've added one.
  const myPhotoUrl = me?.user?.avatar_url || null;
  const myPhotoIcon = useMemo(
    () =>
      myPhotoUrl
        ? function MyPhoto({ size = 24 }) {
            return <img src={myPhotoUrl} alt="" width={size} height={size} className="rounded-full object-cover ring-1 ring-white/60" style={{ width: size, height: size }} />;
          }
        : null,
    [myPhotoUrl]
  );

  const openGroup = (id, name, role, features, options = {}) =>
    setActiveGroup({
      id,
      name,
      role,
      features: features || [],
      initialTab: options.initialTab,
      initialThreadId: options.initialThreadId,
      initialChannel: options.initialChannel,
      initialProgramId: options.initialProgramId,
      nonce: (options.nonce ?? 0),
    });
  const backToHub = () => {
    setActiveGroup(null);
    setTab("hub");
  };

  // Routes a clicked push notification (or any other deep link) to the
  // actual screen it's about, instead of always landing on Home. Every
  // notify() call site across the app now builds a url like
  // "/?group=<id>&tab=<groupTab>" (optionally &thread=/&channel=) or
  // "/?tab=<globalTab>" or "/?admin=toolbox" -- see lib/push.js callers.
  // Runs once, the first time `me` is available, since this only makes
  // sense as a one-time "where did this link want me to go" resolution.
  //
  // v71 #4: the resolver is a plain function so an in-app tap (a row in
  // the notifications list) can use exactly the same routing as a push
  // click, without a full page reload -- see openNotificationUrl below.
  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (deepLinkHandledRef.current || !deepLink) return;
    deepLinkHandledRef.current = true;
    routeDeepLink(deepLink);
  }, [deepLink, me]);

  const routeDeepLink = (dl) =>
    (async () => {
      const { groupId, groupTab, thread, channel, program, tab: globalTab, admin, whatsnew } = dl;

      if (admin === "toolbox") {
        // v71 #19: with Admin Privileges off the Toolbox can't load anything
        // (the server treats this device as a regular member), so don't open
        // an empty shell -- say how to get to it instead.
        if (!me.user.is_church_admin) {
          if (me.user.has_admin_role) toast.info("Turn on Admin Privileges in Settings to review this.");
          return;
        }
        setAdminToolboxOpen(true);
        return;
      }

      if (whatsnew) {
        markSeen("whats-new");
        setPatchNotesOpen(true);
        markNotificationsReadFor("/?whatsnew=1");
        return;
      }

      if (groupId) {
        const membership = me.memberships.find((m) => m.group_id === groupId);
        if (membership) {
          openGroup(groupId, membership.group?.name || "Ministry", membership.role, membership.group?.features, {
            initialTab: groupTab,
            initialThreadId: thread,
            initialChannel: channel,
            initialProgramId: program,
            nonce: Date.now(),
          });
          return;
        }
        // Not (or no longer) a member -- a Church Admin can still open
        // any group for management purposes (e.g. a join-request
        // notification pointing at a group they don't personally
        // belong to), so look it up via the admin-visible groups list.
        if (me.user.is_church_admin) {
          try {
            const res = await fetch("/api/groups");
            const data = await res.json();
            const g = (data.groups || []).find((x) => x.id === groupId);
            if (g) {
              openGroup(groupId, g.name, "admin", g.features, {
                initialTab: groupTab,
                initialThreadId: thread,
                initialChannel: channel,
              });
              return;
            }
          } catch {
            // Fall through to Home below.
          }
        }
        return;
      }

      if (globalTab) switchTab(globalTab);
    })();

  // Same URL scheme push notifications use ("/?group=<id>&tab=<tab>",
  // "/?tab=<tab>", "/?admin=toolbox", ...), navigated in-app.
  const openNotificationUrl = (url) => {
    if (!url) return;
    let params;
    try {
      params = new URL(url, window.location.origin).searchParams;
    } catch {
      return;
    }
    const group = params.get("group");
    routeDeepLink({
      groupId: group,
      groupTab: group ? params.get("tab") : null,
      thread: params.get("thread"),
      channel: params.get("channel"),
      program: params.get("program"),
      tab: group ? null : params.get("tab"),
      admin: params.get("admin"),
      whatsnew: params.get("whatsnew"),
    });
  };

  // v71.25: tapping the mini player brings you back to what is playing.
  const openOriginRef = useRef(null);
  openOriginRef.current = (o) => {
    if (!me?.user || !o?.groupId) return;
    const qs = new URLSearchParams({ group: o.groupId, tab: o.tab || "programs" });
    if (o.programId) qs.set("program", o.programId);
    openNotificationUrl(`/?${qs.toString()}`);
  };
  useEffect(() => {
    const onBible = (e) => e.detail?.book && setBibleOverlay({ book: e.detail.book, chapter: e.detail.chapter });
    window.addEventListener(OPEN_BIBLE_EVENT, onBible);
    return () => window.removeEventListener(OPEN_BIBLE_EVENT, onBible);
  }, []);
  useEffect(() => {
    const onOpen = (e) => openOriginRef.current?.(e.detail);
    window.addEventListener(OPEN_ORIGIN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ORIGIN_EVENT, onOpen);
  }, []);

  // Lets Reading Plan (or anything else nested inside a group) jump into
  // the universal Bible tab at a specific passage without losing your
  // place in the group. activeGroup is deliberately never cleared here --
  // closing the overlay just returns to whatever was already being shown
  // (same group, same day, same subtab), because nothing about that state
  // was touched.
  const openBiblePassage = (book, chapter) => setBibleOverlay({ book, chapter });
  const closeBibleOverlay = () => setBibleOverlay(null);

  // What "Refresh" does. A refresh needs to hit three things, not just the
  // current tab's own content:
  //  1. refreshMe() -- re-fetches /api/me, which is the actual source of each
  //     ministry card's Request/Pending state. Bumping refreshNonce alone
  //     remounts HomeTab and makes IT refetch /api/groups fresh, but `me`
  //     itself is a prop passed down from further up the tree -- without this
  //     call it stays the same stale object, which is exactly why tapping
  //     refresh after a join request or an approval didn't change the card
  //     (a real bug: refreshMe was available here and simply never called).
  //  2. refreshNonce -- remounts the current tab's content so its own data
  //     (events, news, groups list, etc.) refetches too.
  //  3. refreshNotifications() -- updates the bell badge.
  //  0. invalidate(everything) -- the shared screen cache (v71 #42-45) treats a
  //     list as fresh for a couple of minutes, so a remounted tab used to show
  //     its cached copy and fetch nothing: Refresh appeared to do nothing,
  //     most visibly on Sermons. This marks every cached list stale. Only the
  //     screen on view fetches again, right now; the rest refresh the next time
  //     you open them, so one tap on Refresh costs one screen's worth of requests.
  const refreshEverything = () => {
    invalidate(() => true);
    refreshMe();
    setRefreshNonce((n) => n + 1);
    refreshNotifications();
  };

  if (bibleOverlay) {
    return (
      <div className="flex flex-col bg-paper overflow-hidden" style={{ height: viewportHeight }}>
        <header
          className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 bg-[#132560] text-white"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <button onClick={closeBibleOverlay} className="text-sm">
            {activeGroup ? `← Back to ${activeGroup.name}` : "← Back"}
          </button>
          <button
            onClick={() => setHelpOpen(true)}
            aria-label="Help & FAQ"
            title="Help & FAQ"
            className="text-white/90 p-1"
          >
            <HelpCircle size={22} />
          </button>
        </header>
        {/* Must scroll: the wrapper above is a fixed-height,
            overflow-hidden column, so without overflow-y-auto (and
            min-h-0, so this flex child can shrink below its content)
            the scripture ran past the bottom with no way to reach it. */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          <BibleTab
            deviceId={me.user.id}
            target={{ bookAbbr: bibleOverlay.book, startChapter: bibleOverlay.chapter }}
          />
        </main>
        {helpOpen && (
          <HelpView
            onClose={() => setHelpOpen(false)}
            isLeader={isAdmin || me.memberships.some((m) => m.status === "active" && m.role === "leader")}
          />
        )}
      </div>
    );
  }

  if (activeGroup) {
    return (
      <GroupShellScreen
        group={{ ...activeGroup, isAdmin: me.user.is_church_admin }}
        hasAdminRole={me.user.has_admin_role}
        adminMode={me.user.admin_mode}
        adminNotifications={me.user.admin_notifications_enabled}
        myRole={activeGroup.role}
        currentUserId={me.user.id}
        onBackToHub={backToHub}
        onOpenBiblePassage={openBiblePassage}
        refreshMe={refreshMe}
        initialTab={activeGroup.initialTab}
        initialThreadId={activeGroup.initialThreadId}
        initialChannel={activeGroup.initialChannel}
        initialProgramId={activeGroup.initialProgramId}
        key={`${activeGroup.id}-${activeGroup.nonce ?? 0}`}
      />
    );
  }

  return (
    <div className="flex flex-col bg-paper overflow-hidden" style={{ height: viewportHeight }}>
      <header
        className="sticky top-0 z-30 flex justify-between items-center px-4 py-2.5 bg-[#132560] text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.625rem)" }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Image src="/header-logo.png" alt="" width={32} height={32} className="w-8 h-8 rounded flex-shrink-0" />
          <strong
            className="font-serif tracking-wide truncate"
            style={{
              color: "#fff",
              textShadow:
                "-1px -1px 0 #C41E28, 1px -1px 0 #C41E28, -1px 1px 0 #C41E28, 1px 1px 0 #C41E28, 2px 2px 3px rgba(0,0,0,0.7)",
            }}
          >
            <span className="hidden sm:inline">North Hodge Assembly of God</span>
            <span className="sm:hidden">NHAG</span>
          </strong>
        </div>
        <div className={`flex items-center relative flex-shrink-0 ${simple ? "gap-1" : "gap-1.5"}`}>
          {/* Normal mode: the six icon buttons, exactly as before. Simple mode
              keeps ONE row too, with just three buttons that each have a word:
              Alerts, Help, and Menu. Settings, Refresh and the Admin Toolbox are
              not gone -- they are in the Menu (below). */}
          {isAdmin && !simple && (
            <HeaderButton
              simple={simple}
              label="Admin"
              ariaLabel={adminAttention > 0 ? `Admin Toolbox, ${adminAttention} need attention` : "Admin Toolbox"}
              title="Admin Toolbox"
              icon={Wrench}
              onPress={warmAdminToolbox}
              onClick={() => setAdminToolboxOpen(true)}
              badge={
                adminAttention > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-white text-[0.625rem] font-bold leading-[1.125rem] text-center"
                    style={{ color: "#132560" }}
                    aria-hidden="true"
                  >
                    {adminAttention > 99 ? "99+" : adminAttention}
                  </span>
                )
              }
            />
          )}
          {/* Phones pull down to refresh; the button stays on bigger screens. */}
          {!simple && (
            <span className="hidden md:inline-flex">
              <HeaderButton simple={simple} label="Refresh" icon={RotateCw} iconSize={20} onClick={refreshEverything} />
            </span>
          )}
          <HeaderButton
            simple={simple}
            label="Alerts"
            ariaLabel="Notifications"
            title="Notifications"
            icon={Bell}
            onPress={warmNotifications}
            onClick={() => setNotificationsOpen(true)}
            badge={unreadCount > 0 && <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-white" />}
          />
          <HeaderButton
            simple={simple}
            label="Help"
            ariaLabel="Help & FAQ"
            title="Help & FAQ"
            icon={HelpCircle}
            onClick={() => setHelpOpen(true)}
          />
          {!simple && <HeaderButton simple={simple} label="Settings" icon={Settings} onPress={warmSettings} onClick={() => setSettingsOpen(true)} />}
          <HeaderButton
            simple={simple}
            label={simple ? "Menu" : "Me"}
            ariaLabel={simple ? (isAdmin && adminAttention > 0 ? `Menu, ${adminAttention} need attention` : "Menu") : "Profile"}
            title={simple ? "Menu" : me.user.display_name}
            icon={simple ? Menu : myPhotoIcon || UserCircle}
            iconSize={24}
            onClick={() => setProfileMenuOpen((o) => !o)}
            badge={
              simple && isAdmin && adminAttention > 0 && (
                <span
                  className="absolute -top-1 -right-2 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-white text-[0.625rem] font-bold leading-[1.125rem] text-center"
                  style={{ color: "#132560" }}
                  aria-hidden="true"
                >
                  {adminAttention > 99 ? "99+" : adminAttention}
                </span>
              )
            }
          />

          {profileMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
              <div
                className={`absolute right-0 top-full mt-2 bg-card text-ink rounded-xl shadow-xl border border-line py-1.5 z-50 ${
                  simple ? "w-60" : "w-44"
                }`}
              >
                <p className="px-3.5 py-1.5 text-sm text-ink font-medium truncate border-b border-linesoft mb-1">
                  {me.user.display_name}
                </p>
                {isAdmin && (
                  <p className="px-3.5 pb-1.5 -mt-0.5 text-[0.6875rem] text-sage font-semibold border-b border-linesoft mb-1">
                    Admin privileges on
                  </p>
                )}
                {simple && (
                  <>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setSettingsOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 min-h-[48px] text-base text-inksoft"
                    >
                      <Settings size={18} /> Settings
                    </button>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        refreshEverything();
                      }}
                      className="w-full flex items-center gap-3 px-4 min-h-[48px] text-base text-inksoft"
                    >
                      <RotateCw size={18} /> Refresh
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setProfileMenuOpen(false);
                          setAdminToolboxOpen(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 min-h-[48px] text-base text-inksoft"
                      >
                        <Wrench size={18} /> Admin Toolbox
                        {adminAttention > 0 && (
                          <span className="ml-auto text-xs bg-accent text-white rounded-full px-2 py-0.5" aria-label={`${adminAttention} need attention`}>
                            {adminAttention}
                          </span>
                        )}
                      </button>
                    )}
                    <div className="border-t border-linesoft my-1" />
                  </>
                )}
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setProfileViewOpen(true);
                  }}
                  className={`w-full flex items-center gap-2 px-3.5 text-inksoft ${simple ? "min-h-[48px] text-base px-4 gap-3" : "py-2 text-sm"}`}
                >
                  <KeyRound size={simple ? 18 : 14} /> Edit Profile
                </button>
                <button
                  onClick={onSignOut}
                  className={`w-full flex items-center gap-2 px-3.5 text-inksoft ${simple ? "min-h-[48px] text-base px-4 gap-3" : "py-2 text-sm"}`}
                >
                  <LogOut size={simple ? 18 : 14} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {showNotifyBanner && !installOpen && !intro && <NotifyBanner onDone={() => setShowNotifyBanner(false)} onInstallHelp={() => setInstallOpen(true)} />}

      <div className="flex flex-1 min-h-0">
        <Sidebar tab={tab} setTab={switchTab} badges={badges} />
        <PullToRefresh onRefresh={refreshEverything} className="flex-1 overflow-y-auto">
          <TabTransition tabKey={`${tab}-${refreshNonce}`}>
            {tab === "news" && (
              <NewsTab
                isAdmin={me.user.is_church_admin}
                isAnyLeader={me.memberships.some((m) => m.status === "active" && m.role === "leader")}
              />
            )}
            {tab === "events" && <EventsTab isAdmin={me.user.is_church_admin} />}
            {tab === "sermons" && <SermonsTab isAdmin={me.user.is_church_admin} />}
            {tab === "calendar" && <CalendarTab me={me} />}
            {tab === "hub" && (
              <HomeTab
                me={me}
                refreshMe={refreshMe}
                onOpenGroup={openGroup}
                onGoToTab={switchTab}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenDirectory={() => switchTab("directory")}
                onOpenChurchPrayer={() => setChurchPrayerOpen(true)}
                onOpenPassage={openBiblePassage}
                onOnboardingAction={onboardingAction}
                onGoTo={goTo}
              />
            )}
            {tab === "bible" && <BibleTab deviceId={me.user.id} />}
            {tab === "directory" && <DirectoryView me={me} />}
          </TabTransition>
        </PullToRefresh>
      </div>

      {!keyboardVisible && <BottomNav tab={tab} setTab={switchTab} badges={badges} />}

      {settingsOpen && (
        <SettingsView
          me={me}
          refreshMe={refreshMe}
          hasAdminRole={me.user.has_admin_role}
          adminMode={me.user.admin_mode}
          adminNotifications={me.user.admin_notifications_enabled}
          onClose={() => setSettingsOpen(false)}
          onOpenAttribution={() => {
            setSettingsOpen(false);
            setAttributionOpen(true);
          }}
          onOpenPatchNotes={() => {
            setSettingsOpen(false);
            markSeen("whats-new");
            setPatchNotesOpen(true);
            markNotificationsReadFor("/?whatsnew=1");
        markNotificationsReadFor("/?whatsnew=1");
          }}
          hasNewPatchNotes={hasNewContent("whats-new", PATCH_NOTES[0]?.date)}
        />
      )}
      {patchNotesOpen && <PatchNotesView onClose={() => setPatchNotesOpen(false)} />}
      {intro === "walkthrough" && (
        <SetupWalkthrough me={me} refreshMe={refreshMe} onClose={() => setIntro(null)} onOpenInstall={() => setInstallOpen(true)} />
      )}
      {intro === "tour" && (
        <WhatsNewTour
          startAt={tourPausedAt ?? 0}
          onClose={() => {
            setIntro(null);
            setTourPausedAt(null);
          }}
          onGo={(where, index) => {
            setIntro(null);
            tourTargetOpened.current = false;
            setTourPausedAt(index);
            goTo(where);
          }}
        />
      )}
      {biblePickerOpen && <BiblePickerSheet onClose={() => setBiblePickerOpen(false)} />}
      {installOpen && <InstallGuide onClose={() => setInstallOpen(false)} />}
      <DesktopInstallTip />
      {churchPrayerOpen && <ChurchPrayerView isAdmin={isAdmin} onClose={() => setChurchPrayerOpen(false)} />}
      {helpOpen && (
        <HelpView
          onClose={() => setHelpOpen(false)}
          isLeader={isAdmin || me.memberships.some((m) => m.status === "active" && m.role === "leader")}
        />
      )}
      {attributionOpen && <AttributionView onClose={() => setAttributionOpen(false)} />}
      {adminToolboxOpen && isAdmin && (
        <AdminToolboxView
          onClose={() => {
            setAdminToolboxOpen(false);
            refreshNotifications(); // the count may have changed while it was open
          }}
          onOpenGroup={openGroup}
          onAttentionChanged={refreshNotifications}
          currentUserId={me.user.id}
        />
      )}
      {notificationsOpen && (
        <NotificationsView
          onClose={() => {
            setNotificationsOpen(false);
            refreshNotifications();
          }}
          onNavigate={openNotificationUrl}
        />
      )}
      {profileViewOpen && (
        <ProfileView me={me} refreshMe={refreshMe} onClose={() => setProfileViewOpen(false)} />
      )}
    </div>
  );
}

function HomeInner() {
  const searchParams = useSearchParams();
  const [me, setMe] = useState(undefined); // undefined = loading, null = signed out
  const [loadFailed, setLoadFailed] = useState(false); // couldn't reach the server for /api/me
  const toast = useToast();
  const lastPrivileges = useRef(null);
  const lastGroupIds = useRef(new Set());
  const bootedRef = useRef(false); // the first /api/me answer has been handled
  // Install guide over the sign-in screen (v71.29). "New here?" closes it so
  // they can set up their account; it comes back once they're signed in.
  const [signInInstallOpen, setSignInInstallOpen] = useState(false);
  useEffect(() => {
    if (shouldAutoShowInstallGuide()) setSignInInstallOpen(true);
  }, []);

  const load = useCallback(async () => {
    // cache: "no-store" here specifically -- this is the manual/initial
    // load path (also reused by the refresh button via refreshMe), and
    // a refresh must always hit the network for real, never be silently
    // served from the browser's cache of a previous /api/me response.
    // ONLY a clean answer of "no user" means signed out. A timeout, a network
    // problem, a Wi-Fi filter/login page, or a server error is "couldn't
    // check" -- the app keeps whatever it has and tries again, instead of
    // flashing to the sign-in screen or sitting blank.
    let data = null;
    let ok = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch("/api/me", { cache: "no-store", signal: controller.signal });
      try { data = await res.json(); } catch { data = null; }
      ok = res.ok && data !== null && typeof data === "object" && "user" in data;
    } catch {
      ok = false;
    } finally {
      clearTimeout(timer);
    }
    if (!ok) {
      setLoadFailed(true);
      return;
    }
    setLoadFailed(false);
    const next = data.user ? data : null;

    // v71 #42: tell the request cache WHO is signed in before anything on screen
    // fetches (child effects run before parent effects, so this can't wait for
    // one). A different person, or nobody, empties it.
    setCacheUser(next?.user?.id ?? null);
    if (next) {
      // Same account, but what it may see changed: drop admin-era data rather
      // than keep showing it (e.g. after turning Admin Privileges off).
      const privileges = `${next.user.is_church_admin}|${next.user.has_admin_role}|${next.user.admin_mode}`;
      if (lastPrivileges.current !== null && lastPrivileges.current !== privileges) clearResourceCache({ refetchMounted: true });
      lastPrivileges.current = privileges;
      // Lost access to a ministry (removed, or it was archived): forget its data.
      const groupIds = new Set((next.memberships || []).map((m) => m.group_id));
      for (const gid of lastGroupIds.current) if (!groupIds.has(gid)) forget((k) => k.startsWith(`group:${gid}:`));
      lastGroupIds.current = groupIds;
    } else {
      lastPrivileges.current = null;
      lastGroupIds.current = new Set();
    }
    // First launch only: while the welcome screen is still up, start loading
    // Home's data too, so Home shows up already filled in. Never holds the
    // app back more than ~2.5s -- if the network is slow, Home finishes
    // loading on screen like before.
    if (next && !bootedRef.current) {
      await Promise.race([
        Promise.allSettled(HOME_RESOURCES.map((r) => fetchResource(r.key, r.fetcher, { staleMs: r.staleMs }))),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    }
    bootedRef.current = true;
    setMe(next);
    // Once signed in, fetch the ministry screen's code in the background so
    // the first ministry you open starts instantly. (A static file from the
    // CDN, cached by the phone -- not a server function.)
    if (next && !screensPreloaded) {
      screensPreloaded = true;
      setTimeout(() => preloadScreens(next.user.is_church_admin || next.user.has_admin_role), 1200);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Tell the welcome screen what's happening: lift it once there's something
  // to show (Home, or the sign-in screen); say so if the server can't be
  // reached. A brand-new account heading to /setup keeps it up until that
  // page loads, instead of flashing a blank screen.
  useEffect(() => {
    if (me === undefined) setBoot({ failed: loadFailed, retry: () => load() });
    else if (me === null || me.user.username) setBoot({ visible: false, failed: false });
  }, [me, loadFailed, load]);

  // First load failed (bad Wi-Fi, server hiccup): keep trying quietly instead of
  // sitting blank. Gentle backoff: 3s, 6s, 12s ... capped at 20s.
  const retryCount = useRef(0);
  useEffect(() => {
    if (me !== undefined || !loadFailed) { retryCount.current = 0; return undefined; }
    const wait = Math.min(3000 * 2 ** retryCount.current, 20000);
    const t = setTimeout(() => { retryCount.current += 1; load(); }, wait);
    return () => clearTimeout(t);
  }, [me, loadFailed, load]);

  useEffect(() => {
    if (me && !me.user.username && typeof window !== "undefined") {
      window.location.href = "/setup";
    }
  }, [me]);

  const signOut = async () => {
    try {
      await requestJson("/api/auth/sign-out", { method: "POST" });
    } catch (err) {
      // If the server couldn't end the session, do NOT pretend we're signed
      // out -- the cookie is still valid on this device.
      toast.error(`Couldn't sign out: ${err.message}`);
      return;
    }
    // Nothing personal stays behind on a shared device (v71 #13): drafts, and
    // now every cached page of data and remembered search/scroll (#42).
    clearAllJournalDrafts();
    setCacheUser(null);
    lastPrivileges.current = null;
    lastGroupIds.current = new Set();
    setMe(null);
  };

  // Still starting up: the welcome screen (BootSplash, above everything) is
  // showing; nothing to draw underneath yet.
  if (me === undefined) return null;
  if (me === null) {
    return (
      <>
        <SignInScreen authError={searchParams.get("authError")} />
        {signInInstallOpen && <InstallGuide variant="signin" onClose={() => setSignInInstallOpen(false)} />}
      </>
    );
  }
  if (!me.user.username) return null; // redirecting to /setup

  // Built once per load from whatever query params got us here -- a
  // clicked push notification's url, or any other deep link into the
  // app. Scheme: "/?group=<id>&tab=<groupTab>" (optionally
  // "&thread=<id>" or "&channel=members|leaders") opens that group
  // straight to a tab; "/?tab=<globalTab>" opens a top-level tab;
  // "/?admin=toolbox" opens the Admin Toolbox. AppShell consumes this
  // exactly once (see its deepLinkHandledRef effect); left in the
  // address bar afterward, harmless on refresh.
  const deepLink =
    searchParams.get("group") || searchParams.get("tab") || searchParams.get("admin") || searchParams.get("whatsnew")
      ? {
          groupId: searchParams.get("group"),
          groupTab: searchParams.get("group") ? searchParams.get("tab") : null,
          thread: searchParams.get("thread"),
          channel: searchParams.get("channel"),
          tab: searchParams.get("group") ? null : searchParams.get("tab"),
          admin: searchParams.get("admin"),
          whatsnew: searchParams.get("whatsnew"),
        }
      : null;

  return <AppShell me={me} refreshMe={load} onSignOut={signOut} deepLink={deepLink} />;
}

export default function Home() {
  return (
    <>
      <BootSplash />
      <Suspense fallback={null}>
        <HomeInner />
      </Suspense>
    </>
  );
}
