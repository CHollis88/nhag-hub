"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import BottomNav from "./components/BottomNav";
import Sidebar from "./components/Sidebar";
import HomeTab from "./components/HomeTab";
import NewsTab from "./components/NewsTab";
import EventsTab from "./components/EventsTab";
import BibleTab from "./components/BibleTab";
import GroupShell from "./components/GroupShell";
import SettingsView from "./components/SettingsView";
import HelpView from "./components/HelpView";
import AttributionView from "./components/AttributionView";
import AdminToolboxView from "./components/AdminToolboxView";
import { isAdminModeOn, setAdminMode } from "@/lib/adminMode";

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
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
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
      const res = await fetch("/api/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
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
      <p className="text-inkfaint text-sm mt-0 mb-4">Church Hub</p>

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

function AppShell({ me, refreshMe, onSignOut }) {
  const [tab, setTab] = useState("hub");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [attributionOpen, setAttributionOpen] = useState(false);
  const [adminToolboxOpen, setAdminToolboxOpen] = useState(false);
  const [adminModeOn, setAdminModeOnState] = useState(true);
  const isAdmin = me.user.is_church_admin;

  useEffect(() => {
    if (isAdmin) setAdminModeOnState(isAdminModeOn());
  }, [isAdmin]);

  const toggleAdminMode = () => {
    const next = !adminModeOn;
    setAdminMode(next);
    setAdminModeOnState(next);
  };
  const [activeGroup, setActiveGroup] = useState(null); // { id, name, role, features } | null
  const [bibleOverlay, setBibleOverlay] = useState(null); // { book, chapter } | null

  const openGroup = (id, name, role, features) => setActiveGroup({ id, name, role, features: features || [] });
  const backToHub = () => {
    setActiveGroup(null);
    setTab("hub");
  };

  // Lets Reading Plan (or anything else nested inside a group) jump into
  // the universal Bible tab at a specific passage without losing your
  // place in the group. activeGroup is deliberately never cleared here --
  // closing the overlay just returns to whatever was already being shown
  // (same group, same day, same subtab), because nothing about that state
  // was touched.
  const openBiblePassage = (book, chapter) => setBibleOverlay({ book, chapter });
  const closeBibleOverlay = () => setBibleOverlay(null);

  if (bibleOverlay) {
    return (
      <div className="min-h-screen flex flex-col bg-paper">
        <header className="flex items-center gap-3 px-4 py-3 bg-navy text-white">
          <button onClick={closeBibleOverlay} className="text-sm">
            {activeGroup ? `← Back to ${activeGroup.name}` : "← Back"}
          </button>
        </header>
        <main className="flex-1">
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
        myRole={activeGroup.role}
        currentUserId={me.user.id}
        onBackToHub={backToHub}
        onOpenBiblePassage={openBiblePassage}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <header className="flex justify-between items-center px-4 py-2.5 bg-navy text-white">
        <div className="flex items-center gap-2.5">
          <img src="/icon-192.png" alt="" className="w-8 h-8 rounded" />
          <strong
            className="font-serif tracking-wide"
            style={{
              color: "#fff",
              textShadow:
                "-1px -1px 0 #C41E28, 1px -1px 0 #C41E28, -1px 1px 0 #C41E28, 1px 1px 0 #C41E28, 2px 2px 3px rgba(0,0,0,0.7)",
            }}
          >
            North Hodge Assembly of God
          </strong>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs hidden sm:inline">{me.user.display_name}</span>
          {isAdmin && adminModeOn && (
            <button
              onClick={() => setAdminToolboxOpen(true)}
              aria-label="Admin Toolbox"
              title="Admin Toolbox"
              className="border border-white/40 rounded px-2 py-1 text-xs"
            >
              🧰
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="border border-white/40 rounded px-2 py-1 text-xs"
          >
            ⚙
          </button>
          <button onClick={onSignOut} className="border border-white/40 rounded px-2 py-1 text-xs">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <Sidebar tab={tab} setTab={setTab} />
        <main className="flex-1 overflow-y-auto">
          {tab === "news" && <NewsTab isAdmin={me.user.is_church_admin} />}
          {tab === "events" && <EventsTab isAdmin={me.user.is_church_admin} />}
          {tab === "hub" && (
            <HomeTab
              me={me}
              refreshMe={refreshMe}
              onOpenGroup={openGroup}
              onGoToTab={setTab}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}
          {tab === "bible" && <BibleTab deviceId={me.user.id} />}
        </main>
      </div>

      <BottomNav tab={tab} setTab={setTab} />

      {settingsOpen && (
        <SettingsView
          isAdmin={me.user.is_church_admin}
          adminModeOn={adminModeOn}
          onToggleAdminMode={toggleAdminMode}
          onClose={() => setSettingsOpen(false)}
          onOpenHelp={() => {
            setSettingsOpen(false);
            setHelpOpen(true);
          }}
          onOpenAttribution={() => {
            setSettingsOpen(false);
            setAttributionOpen(true);
          }}
        />
      )}
      {helpOpen && <HelpView onClose={() => setHelpOpen(false)} />}
      {attributionOpen && <AttributionView onClose={() => setAttributionOpen(false)} />}
      {adminToolboxOpen && (
        <AdminToolboxView onClose={() => setAdminToolboxOpen(false)} onOpenGroup={openGroup} />
      )}
    </div>
  );
}

function HomeInner() {
  const searchParams = useSearchParams();
  const [me, setMe] = useState(undefined); // undefined = loading, null = signed out

  const load = useCallback(async () => {
    const res = await fetch("/api/me");
    const data = await res.json();
    setMe(data.user ? data : null);
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
    await fetch("/api/auth/sign-out", { method: "POST" });
    setMe(null);
  };

  if (me === undefined) return null; // brief load
  if (me === null) return <SignInScreen authError={searchParams.get("authError")} />;
  if (!me.user.username) return null; // redirecting to /setup

  return <AppShell me={me} refreshMe={load} onSignOut={signOut} />;
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}
