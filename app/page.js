"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import BottomNav from "./components/BottomNav";
import HubTab from "./components/HubTab";
import NewsTab from "./components/NewsTab";
import EventsTab from "./components/EventsTab";
import BibleTab from "./components/BibleTab";
import GroupShell from "./components/GroupShell";
import SettingsView from "./components/SettingsView";
import HelpView from "./components/HelpView";

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

function SignInScreen({ authError }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(authError || "");
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
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthCard>
        <h2 className="font-serif text-xl text-ink mb-2">Check your email</h2>
        <p className="text-sm text-inksoft">
          We sent a sign-in link to <strong className="text-ink">{email}</strong>. Click it to
          continue — it expires in 15 minutes.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h2 className="font-serif text-xl text-ink mb-0.5">North Hodge Assembly of God</h2>
      <p className="text-inkfaint text-sm mt-0 mb-4">Church Hub</p>
      <p className="text-sm text-inksoft mb-4">Enter your email to sign in or create an account.</p>
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
      </form>
      {error && <p className="text-sm mt-3 text-red-600 dark:text-red-400">{error}</p>}
    </AuthCard>
  );
}

function AppShell({ me, refreshMe, onSignOut }) {
  const [tab, setTab] = useState("hub");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
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
          <img src="/favicon.png" alt="" className="w-7 h-7 rounded" />
          <strong className="font-serif">NHAG Church Hub</strong>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs hidden sm:inline">{me.user.display_name}</span>
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

      <main className="flex-1">
        {tab === "news" && <NewsTab isAdmin={me.user.is_church_admin} />}
        {tab === "events" && <EventsTab isAdmin={me.user.is_church_admin} />}
        {tab === "hub" && <HubTab me={me} refreshMe={refreshMe} onOpenGroup={openGroup} />}
        {tab === "bible" && <BibleTab deviceId={me.user.id} />}
      </main>

      <BottomNav tab={tab} setTab={setTab} />

      {settingsOpen && (
        <SettingsView
          onClose={() => setSettingsOpen(false)}
          onOpenHelp={() => {
            setSettingsOpen(false);
            setHelpOpen(true);
          }}
        />
      )}
      {helpOpen && <HelpView onClose={() => setHelpOpen(false)} />}
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
