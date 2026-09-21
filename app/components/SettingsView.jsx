"use client";

import { useEffect, useState } from "react";
import { getStoredPreference, applyTheme, getStoredTextSize, applyTextSize } from "@/lib/theme";
import { getDesktopMode, setDesktopMode } from "@/lib/desktopMode";
import { isSubscribedToPush, subscribeToPush, unsubscribeFromPush } from "@/lib/pushClient";
import { isAdminModeOn, setAdminMode } from "@/lib/adminMode";
import FeedbackModal from "./FeedbackModal";
import packageJson from "../../package.json";

const THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];
const TEXT_SIZES = [
  { id: "xxs", label: "Tiny" },
  { id: "xs", label: "Smallest" },
  { id: "sm", label: "Small" },
  { id: "md", label: "Default" },
  { id: "lg", label: "Large" },
  { id: "xl", label: "Larger" },
  { id: "xxl", label: "Largest" },
  { id: "xxxl", label: "Maximum" },
];

export default function SettingsView({ onClose, onOpenHelp, onOpenAttribution, onOpenPatchNotes, hasNewPatchNotes, isAdmin, adminModeOn: controlledAdminModeOn, onToggleAdminMode }) {
  const [theme, setTheme] = useState("system");
  const [showFeedback, setShowFeedback] = useState(false);
  const [textSize, setTextSize] = useState("md");
  const [desktopLayout, setDesktopLayoutState] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [prefs, setPrefs] = useState(null);
  const [localAdminModeOn, setLocalAdminModeOn] = useState(true);

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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-t-2xl w-full max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex justify-between items-center mb-4 gap-2">
          <h2 className="font-serif text-xl text-ink m-0 min-w-0 truncate">Settings</h2>
          <button onClick={onClose} className="text-2xl text-inkfaint leading-none flex-shrink-0">×</button>
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

        <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">
          Text Size — {TEXT_SIZES.find((t) => t.id === textSize)?.label}
        </p>
        <input
          type="range"
          min="0"
          max={TEXT_SIZES.length - 1}
          step="1"
          value={TEXT_SIZES.findIndex((t) => t.id === textSize)}
          onChange={(e) => chooseTextSize(TEXT_SIZES[Number(e.target.value)].id)}
          className="w-full mb-1"
        />
        <div className="flex justify-between text-[0.625rem] text-inkfaint mb-5">
          <span>A</span>
          <span className="text-base">A</span>
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
          <button onClick={onOpenPatchNotes} className="sp-btn-secondary mt-1 mr-2 relative">
            What's New
            {hasNewPatchNotes && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent border border-card" />
            )}
          </button>
          <button onClick={onOpenAttribution} className="sp-btn-secondary mt-1 mr-2">
            Sources &amp; Attribution
          </button>
          <button onClick={() => setShowFeedback(true)} className="sp-btn-secondary mt-1">
            Send Feedback
          </button>
        </div>

        <p className="text-[0.6875rem] text-inkfaint mt-5 text-center">Version {packageJson.version}</p>
      </div>
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </div>
  );
}
