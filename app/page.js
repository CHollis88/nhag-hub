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

function box(children) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0B1A3D",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          padding: 32,
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          textAlign: "center",
        }}
      >
        <img
          src="/icon-192.png"
          alt="North Hodge Assembly of God"
          style={{ width: 96, height: 96, margin: "0 auto 16px", display: "block" }}
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
    return box(
      <>
        <h2>Check your email</h2>
        <p>
          We sent a sign-in link to <strong>{email}</strong>. Click it to continue — it expires
          in 15 minutes.
        </p>
      </>
    );
  }

  return box(
    <>
      <h2 style={{ margin: "0 0 4px" }}>North Hodge Assembly of God</h2>
      <p style={{ color: "#666", marginTop: 0 }}>Church Hub</p>
      <p>Enter your email to sign in or create an account.</p>
      <form onSubmit={submit}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12, boxSizing: "border-box" }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: 12, fontSize: 16, background: "#16296B", color: "#fff", border: "none", borderRadius: 6 }}
        >
          {loading ? "Sending…" : "Send me a sign-in link"}
        </button>
      </form>
      {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
    </>
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
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            background: "#16296B",
            color: "#fff",
          }}
        >
          <button
            onClick={closeBibleOverlay}
            style={{ background: "none", border: "none", color: "#fff", fontSize: 16, cursor: "pointer" }}
          >
            {activeGroup ? `← Back to ${activeGroup.name}` : "← Back"}
          </button>
        </header>
        <main style={{ flex: 1 }}>
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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          background: "#16296B",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/favicon.png" alt="" style={{ width: 28, height: 28 }} />
          <strong>NHAG Church Hub</strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13 }}>{me.user.display_name}</span>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            style={{ background: "none", border: "1px solid #fff", color: "#fff", borderRadius: 4, padding: "4px 8px", fontSize: 12 }}
          >
            ⚙
          </button>
          <button
            onClick={onSignOut}
            style={{ background: "none", border: "1px solid #fff", color: "#fff", borderRadius: 4, padding: "4px 8px", fontSize: 12 }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main style={{ flex: 1 }}>
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
