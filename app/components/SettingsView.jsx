"use client";

import { useEffect, useState } from "react";
import { getStoredPreference, applyTheme, getStoredTextSize, applyTextSize } from "@/lib/theme";
import { getDesktopMode, setDesktopMode } from "@/lib/desktopMode";
import { isSubscribedToPush, subscribeToPush, unsubscribeFromPush } from "@/lib/pushClient";

const THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];
const TEXT_SIZES = [
  { id: "xs", label: "Smallest" },
  { id: "sm", label: "Small" },
  { id: "md", label: "Default" },
  { id: "lg", label: "Large" },
  { id: "xl", label: "Larger" },
  { id: "xxl", label: "Largest" },
];

export default function SettingsView({ onClose, onOpenHelp }) {
  const [theme, setTheme] = useState("system");
  const [textSize, setTextSize] = useState("md");
  const [desktopLayout, setDesktopLayoutState] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [prefs, setPrefs] = useState(null);

  useEffect(() => {
    setTheme(getStoredPreference());
    setTextSize(getStoredTextSize());
    setDesktopLayoutState(getDesktopMode());
    setPushSubscribed(isSubscribedToPush());
    fetch("/api/notifications/preferences")
      .then((r) => r.json())
      .then(setPrefs);
  }, []);

  const chooseTheme = (id) => {
    setTheme(id);
    applyTheme(id);
  };
  const chooseTextSize = (id) => {
    setTextSize(id);
    applyTextSize(id);
  };
  const toggleDesktopLayout = () => {
    const next = !desktopLayout;
    setDesktopLayoutState(next);
    setDesktopMode(next);
  };

  const togglePush = async () => {
    setPushBusy(true);
    if (pushSubscribed) {
      await unsubscribeFromPush();
      setPushSubscribed(false);
    } else {
      const result = await subscribeToPush();
      if (result.ok) setPushSubscribed(true);
    }
    setPushBusy(false);
  };

  const setGlobalPref = async (enabled) => {
    setPrefs((p) => ({ ...p, global: enabled }));
    await fetch("/api/notifications/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "global", enabled }),
    });
  };

  const setGroupPref = async (groupId, enabled) => {
    setPrefs((p) => ({
      ...p,
      groups: p.groups.map((g) => (g.group_id === groupId ? { ...g, enabled } : g)),
    }));
    await fetch("/api/notifications/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "group", group_id: groupId, enabled }),
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "16px 16px 0 0",
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: 24,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Settings</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 20 }}>×</button>
        </div>

        <h3>Theme</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => chooseTheme(t.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: theme === t.id ? "2px solid #16296B" : "1px solid #ccc",
                background: theme === t.id ? "#16296B" : "#fff",
                color: theme === t.id ? "#fff" : "#333",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <h3>Text Size</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {TEXT_SIZES.map((t) => (
            <button
              key={t.id}
              onClick={() => chooseTextSize(t.id)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 13,
                border: textSize === t.id ? "2px solid #16296B" : "1px solid #ccc",
                background: textSize === t.id ? "#16296B" : "#fff",
                color: textSize === t.id ? "#fff" : "#333",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <h3>Desktop Layout</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <input type="checkbox" checked={desktopLayout} onChange={toggleDesktopLayout} />
          Use wide desktop layout on larger screens
        </label>

        <h3>Notifications</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <input type="checkbox" checked={pushSubscribed} onChange={togglePush} disabled={pushBusy} />
          Enable push notifications on this device
        </label>
        <p style={{ fontSize: 12, color: "#666", marginTop: 0, marginBottom: 16 }}>
          Turn this on once per device (phone, laptop, etc.) to receive anything below.
        </p>

        {prefs && (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <input type="checkbox" checked={prefs.global} onChange={(e) => setGlobalPref(e.target.checked)} />
              Church-wide News &amp; Events
            </label>
            {prefs.groups?.map((g) => (
              <label key={g.group_id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <input type="checkbox" checked={g.enabled} onChange={(e) => setGroupPref(g.group_id, e.target.checked)} />
                {g.name}
              </label>
            ))}
          </>
        )}

        <button onClick={onOpenHelp} style={{ marginTop: 20, padding: "8px 16px" }}>
          Help / FAQ
        </button>
      </div>
    </div>
  );
}
