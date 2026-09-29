"use client";

import HeaderButton from "./components/HeaderButton";
import { useSimpleMode } from "@/lib/useSimpleMode";
import { setCacheUser, clearResourceCache, forget } from "@/lib/resourceCache";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
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

// Everything below here is only ever shown after a tab switch or an explicit
// open action, so it's a code-splitting candidate: keeps it out of the initial
// JS bundle and loads it the first time it's actually needed.
const NewsTab = dynamic(() => import("./components/NewsTab"), { loading: () => <TabSkeleton /> });
const EventsTab = dynamic(() => import("./components/EventsTab"), { loading: () => <TabSkeleton /> });
const BibleTab = dynamic(() => import("./components/BibleTab"), { loading: () => <TabSkeleton /> });
const SermonsTab = dynamic(() => import("./components/SermonsTab"), { loading: () => <TabSkeleton /> });
const CalendarTab = dynamic(() => import("./components/CalendarTab"), { loading: () => <TabSkeleton /> });
const GroupShell = dynamic(() => import("./components/GroupShell"), { loading: () => <TabSkeleton /> });
const SettingsView = dynamic(() => import("./components/SettingsView"));
const HelpView = dynamic(() => import("./components/HelpView"));
const PatchNotesView = dynamic(() => import("./components/PatchNotesView"));
const AttributionView = dynamic(() => import("./components/AttributionView"));
const AdminToolboxView = dynamic(() => import("./components/AdminToolboxView"));
const DirectoryView = dynamic(() => import("./components/DirectoryView"));
const NotificationsView = dynamic(() => import("./components/NotificationsView"));
const ProfileView = dynamic(() => import("./components/ProfileView"));
import { Bell, Settings, Wrench, UserCircle, LogOut, KeyRound, HelpCircle, RotateCw, Menu } from "lucide-react";
import { hasNewContent, markSeen } from "@/lib/lastSeen";
import { PATCH_NOTES } from "@/lib/patchNotes";
import { useKeyboardVisible } from "@/lib/useKeyboardVisible";
import { useViewportHeight } from "@/lib/useViewportHeight";
import { requestJson } from "@/lib/request";
import { clearAllJournalDrafts } from "@/lib/journalDrafts";
import { useToast } from "./components/ToastProvider";

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
  const [profileViewOpen, setProfileViewOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
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
  const refreshNotifications = useCallback(() => {
    fetch("/api/notifications/latest")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setLatestContent(data);
        if (typeof data.unread_count === "number") setUnreadCount(data.unread_count);
        // Present only for an effective admin (v71 #22); absent otherwise.
        setAdminAttention(typeof data.admin_attention_count === "number" ? data.admin_attention_count : 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshNotifications();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refreshNotifications();
    }, 45000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshNotifications();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const onSwMessage = (event) => {
      if (event.data?.type === "NEW_NOTIFICATION") refreshNotifications();
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

  const [activeGroup, setActiveGroup] = useState(null); // { id, name, role, features } | null
  const [bibleOverlay, setBibleOverlay] = useState(null); // { book, chapter } | null

  const openGroup = (id, name, role, features, options = {}) =>
    setActiveGroup({
      id,
      name,
      role,
      features: features || [],
      initialTab: options.initialTab,
      initialThreadId: options.initialThreadId,
      initialChannel: options.initialChannel,
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
      const { groupId, groupTab, thread, channel, tab: globalTab, admin, whatsnew } = dl;

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
        return;
      }

      if (groupId) {
        const membership = me.memberships.find((m) => m.group_id === groupId);
        if (membership) {
          openGroup(groupId, membership.group?.name || "Ministry", membership.role, membership.group?.features, {
            initialTab: groupTab,
            initialThreadId: thread,
            initialChannel: channel,
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
      tab: group ? null : params.get("tab"),
      admin: params.get("admin"),
      whatsnew: params.get("whatsnew"),
    });
  };

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
  const refreshEverything = () => {
    refreshMe();
    setRefreshNonce((n) => n + 1);
    refreshNotifications();
  };

  if (bibleOverlay) {
    return (
      <div className="flex flex-col bg-paper overflow-hidden" style={{ height: viewportHeight }}>
        <header
          className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[#132560] text-white"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <button onClick={closeBibleOverlay} className="text-sm">
            {activeGroup ? `← Back to ${activeGroup.name}` : "← Back"}
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
      </div>
    );
  }

  if (activeGroup) {
    return (
      <GroupShell
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
          {!simple && <HeaderButton simple={simple} label="Refresh" icon={RotateCw} iconSize={20} onClick={refreshEverything} />}
          <HeaderButton
            simple={simple}
            label="Alerts"
            ariaLabel="Notifications"
            title="Notifications"
            icon={Bell}
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
          {!simple && <HeaderButton simple={simple} label="Settings" icon={Settings} onClick={() => setSettingsOpen(true)} />}
          <HeaderButton
            simple={simple}
            label={simple ? "Menu" : "Me"}
            ariaLabel={simple ? (isAdmin && adminAttention > 0 ? `Menu, ${adminAttention} need attention` : "Menu") : "Profile"}
            title={simple ? "Menu" : me.user.display_name}
            icon={simple ? Menu : UserCircle}
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

      {showNotifyBanner && <NotifyBanner onDone={() => setShowNotifyBanner(false)} />}

      <div className="flex flex-1 min-h-0">
        <Sidebar tab={tab} setTab={switchTab} badges={badges} />
        <main className="flex-1 overflow-y-auto">
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
              />
            )}
            {tab === "bible" && <BibleTab deviceId={me.user.id} />}
            {tab === "directory" && <DirectoryView me={me} />}
          </TabTransition>
        </main>
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
          onOpenHelp={() => {
            setSettingsOpen(false);
            setHelpOpen(true);
          }}
          onOpenAttribution={() => {
            setSettingsOpen(false);
            setAttributionOpen(true);
          }}
          onOpenPatchNotes={() => {
            setSettingsOpen(false);
            markSeen("whats-new");
            setPatchNotesOpen(true);
          }}
          hasNewPatchNotes={hasNewContent("whats-new", PATCH_NOTES[0]?.date)}
        />
      )}
      {patchNotesOpen && <PatchNotesView onClose={() => setPatchNotesOpen(false)} />}
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
  const toast = useToast();
  const lastPrivileges = useRef(null);
  const lastGroupIds = useRef(new Set());

  const load = useCallback(async () => {
    // cache: "no-store" here specifically -- this is the manual/initial
    // load path (also reused by the refresh button via refreshMe), and
    // a refresh must always hit the network for real, never be silently
    // served from the browser's cache of a previous /api/me response.
    const res = await fetch("/api/me", { cache: "no-store" });
    const data = await res.json();
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
    setMe(next);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  if (me === undefined) return null; // brief load
  if (me === null) return <SignInScreen authError={searchParams.get("authError")} />;
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
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}
