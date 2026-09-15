"use client";

import { useEffect, useState } from "react";
import { getStoredPreference, applyTheme, getStoredTextSize, applyTextSize } from "@/lib/theme";
import { getDesktopMode, setDesktopMode } from "@/lib/desktopMode";
import { isSubscribedToPush, subscribeToPush, unsubscribeFromPush } from "@/lib/pushClient";
import { isAdminModeOn, setAdminMode } from "@/lib/adminMode";

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

export default function SettingsView({ onClose, onOpenHelp, onOpenAttribution, isAdmin, adminModeOn: controlledAdminModeOn, onToggleAdminMode }) {
  const [theme, setTheme] = useState("system");
  const [textSize, setTextSize] = useState("md");
  const [desktopLayout, setDesktopLayoutState] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [prefs, setPrefs] = useState(null);
  const [localAdminModeOn, setLocalAdminModeOn] = useState(true);
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [pinMessage, setPinMessage] = useState("");

  // Controlled (from AppShell, which also shows a header emblem that
  // needs to stay in sync) if onToggleAdminMode is passed; otherwise
  // self-managed (from inside a group's own Settings, which has no
  // emblem to keep in sync with).
  const isControlled = onToggleAdminMode !== undefined;
  const adminModeOn = isControlled ? controlledAdminModeOn : localAdminModeOn;

  useEffect(() => {
    setTheme(getStoredPreference());
    setTextSize(getStoredTextSize());
    setDesktopLayoutState(getDesktopMode());
    isSubscribedToPush().then(setPushSubscribed);
    if (isAdmin && !isControlled) setLocalAdminModeOn(isAdminModeOn());
    fetch("/api/notifications/preferences")
      .then((r) => r.json())
      .then(setPrefs);
  }, [isAdmin, isControlled]);

  const toggleAdminMode = () => {
    if (isControlled) {
      onToggleAdminMode();
      return;
    }
    const next = !localAdminModeOn;
    setAdminMode(next);
    setLocalAdminModeOn(next);
  };

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

  const changePin = async (e) => {
    e.preventDefault();
    setPinMessage("");
    if (newPin !== confirmNewPin) {
      setPinMessage("PINs don't match.");
      return;
    }
    const res = await fetch("/api/auth/reset-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: newPin }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPinMessage(data.error);
      return;
    }
    setNewPin("");
    setConfirmNewPin("");
    setPinMessage("PIN updated.");
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-t-2xl w-full max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-xl text-ink m-0">Settings</h2>
          <button onClick={onClose} className="text-2xl text-inkfaint leading-none">×</button>
        </div>

        <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Theme</p>
        <div className="flex gap-2 mb-5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => chooseTheme(t.id)}
              className={theme === t.id ? "sp-pill-outline active" : "sp-pill-outline"}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Text Size</p>
        <div className="flex gap-1.5 flex-wrap mb-5">
          {TEXT_SIZES.map((t) => (
            <button
              key={t.id}
              onClick={() => chooseTextSize(t.id)}
              className={textSize === t.id ? "sp-pill-outline active" : "sp-pill-outline"}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Desktop Layout</p>
        <label className="flex items-center gap-2.5 mb-5 text-sm text-inksoft">
          <input type="checkbox" checked={desktopLayout} onChange={toggleDesktopLayout} />
          Use wide desktop layout on larger screens
        </label>

        <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Notifications</p>
        <label className="flex items-center gap-2.5 mb-1.5 text-sm text-inksoft">
          <input type="checkbox" checked={pushSubscribed} onChange={togglePush} disabled={pushBusy} />
          Enable push notifications on this device
        </label>
        <p className="text-xs text-inkfaint mt-0 mb-4">
          Turn this on once per device (phone, laptop, etc.) to receive anything below.
        </p>

        {prefs && (
          <>
            <label className="flex items-center gap-2.5 mb-1.5 text-sm text-inksoft">
              <input type="checkbox" checked={prefs.global} onChange={(e) => setGlobalPref(e.target.checked)} />
              Church-wide News &amp; Events
            </label>
            {prefs.groups?.map((g) => (
              <label key={g.group_id} className="flex items-center gap-2.5 mb-1.5 text-sm text-inksoft">
                <input type="checkbox" checked={g.enabled} onChange={(e) => setGroupPref(g.group_id, e.target.checked)} />
                {g.name}
              </label>
            ))}
          </>
        )}

        <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Change PIN</p>
        <form onSubmit={changePin} className="mb-5">
          <input
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
            placeholder="New PIN (4–8 digits)"
            inputMode="numeric"
            className="sp-input mb-2"
          />
          <input
            value={confirmNewPin}
            onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))}
            placeholder="Confirm new PIN"
            inputMode="numeric"
            className="sp-input mb-2"
          />
          <button type="submit" className="sp-btn-secondary">Update PIN</button>
          {pinMessage && <p className="text-sm text-inksoft mt-2">{pinMessage}</p>}
        </form>

        {isAdmin && (
          <>
            <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Admin</p>
            <label className="flex items-center gap-2.5 mb-3 text-sm text-inksoft">
              <input type="checkbox" checked={adminModeOn} onChange={toggleAdminMode} />
              Show admin tools
            </label>
            <p className="text-xs text-inkfaint mt-0 mb-5">
              This is just a personal display preference — it never changes your actual admin
              access, only whether the extra controls show up in your own view (including the
              toolbox emblem in the header). Turning it back on doesn't need your PIN, since
              nothing was ever actually revoked.
            </p>
          </>
        )}

        <div>
          <button onClick={onOpenHelp} className="sp-btn-secondary mt-1 mr-2">
            Help / FAQ
          </button>
          <button onClick={onOpenAttribution} className="sp-btn-secondary mt-1">
            Sources &amp; Attribution
          </button>
        </div>
      </div>
    </div>
  );
}
