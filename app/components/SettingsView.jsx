"use client";

import { useCallback, useEffect, useState } from "react";
import { getStoredPreference, applyTheme, getStoredTextSize, applyTextSize } from "@/lib/theme";
import { getDesktopMode, setDesktopMode } from "@/lib/desktopMode";
import { isSubscribedToPush, subscribeToPush, unsubscribeFromPush } from "@/lib/pushClient";
import FeedbackModal from "./FeedbackModal";
import packageJson from "../../package.json";
import Modal from "./Modal";
import { requestJson } from "@/lib/request";
import { useAction } from "./useAction";
import { useToast } from "./ToastProvider";
import { usePinPrompt } from "./PinPrompt";
import Switch from "./Switch";
import { useSimpleMode } from "@/lib/useSimpleMode";
import { setSimpleMode } from "@/lib/simpleMode";

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

export default function SettingsView({ onClose, onOpenHelp, onOpenAttribution, onOpenPatchNotes, hasNewPatchNotes, hasAdminRole, adminMode, adminNotifications, refreshMe }) {
  const run = useAction();
  const toast = useToast();
  const askPin = usePinPrompt();
  const simple = useSimpleMode();
  const [theme, setTheme] = useState("system");
  const [showFeedback, setShowFeedback] = useState(false);
  const [textSize, setTextSize] = useState("md");
  const [desktopLayout, setDesktopLayoutState] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [prefs, setPrefs] = useState(null); // null = loading
  const [prefsFailed, setPrefsFailed] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);

  const loadPrefs = useCallback(async () => {
    setPrefsFailed(false);
    try {
      setPrefs(await requestJson("/api/notifications/preferences"));
    } catch {
      setPrefsFailed(true);
    }
  }, []);

  useEffect(() => {
    setTheme(getStoredPreference());
    setTextSize(getStoredTextSize());
    setDesktopLayoutState(getDesktopMode());
    isSubscribedToPush().then(setPushSubscribed);
    loadPrefs();
  }, [loadPrefs]);

  const chooseTheme = (id) => {
    setTheme(id);
    applyTheme(id);
  };
  const chooseTextSize = (id) => {
    setTextSize(id);
    applyTextSize(id);
  };
  // v71 -- Simple mode: a setting of THIS DEVICE (so a helper can set it up on
  // someone's own phone). Turning it on also nudges the text up one notch, but
  // only if it is still at the Default size -- a size the person picked is left
  // alone -- and says so, rather than changing something silently.
  const toggleSimple = (next) => {
    setSimpleMode(next);
    if (next && getStoredTextSize() === "md") {
      chooseTextSize("lg");
      toast.success("Simple mode is on. We made the text a little larger — you can change that below.");
    } else {
      toast.success(next ? "Simple mode is on." : "Simple mode is off.");
    }
  };
  const setDesktopLayout = (next) => {
    setDesktopLayoutState(next);
    setDesktopMode(next);
  };

  // Turning push on/off can't be optimistic: the browser has to grant (or
  // remove) permission first, so the switch shows a busy state and only
  // moves once that has actually happened.
  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (pushSubscribed) {
        const result = await unsubscribeFromPush();
        if (result.ok) setPushSubscribed(false);
        else toast.error(result.message || "Couldn't turn notifications off. Try again.");
      } else {
        const result = await subscribeToPush();
        if (result.ok) {
          setPushSubscribed(true);
        } else if (result.reason === "denied") {
          toast.error("Notifications are blocked. Allow them in your browser or phone settings, then try again.");
        } else if (result.reason === "unsupported") {
          toast.error("This device or browser doesn't support notifications.");
        } else {
          toast.error(result.message || "Couldn't turn notifications on. Try again.");
        }
      }
    } finally {
      setPushBusy(false);
    }
  };

  // Topic switches are optimistic (they move at once) and roll back, with
  // the reason in a toast, if the server didn't save them.
  const setGlobalPref = async (enabled) => {
    setPrefs((p) => ({ ...p, global: enabled }));
    const { ok } = await run(() =>
      requestJson("/api/notifications/preferences", { method: "POST", body: { scope: "global", enabled } })
    );
    if (!ok) setPrefs((p) => ({ ...p, global: !enabled }));
  };

  const setGroupPref = async (groupId, enabled) => {
    setPrefs((p) => ({
      ...p,
      groups: p.groups.map((g) => (g.group_id === groupId ? { ...g, enabled } : g)),
    }));
    const { ok } = await run(() =>
      requestJson("/api/notifications/preferences", { method: "POST", body: { scope: "group", group_id: groupId, enabled } })
    );
    if (!ok) {
      setPrefs((p) => ({
        ...p,
        groups: p.groups.map((g) => (g.group_id === groupId ? { ...g, enabled: !enabled } : g)),
      }));
    }
  };

  // v71 #19 / #20 -- "Use Admin Privileges" is a REAL, server-enforced switch.
  // Off is immediate: from that moment the server treats this device as a
  // regular member. On asks for your PIN. The screen follows the server's
  // answer (refreshMe), never a guess -- so these two are not optimistic.
  const toggleAdminPrivileges = async () => {
    if (adminBusy) return;
    if (adminMode) {
      setAdminBusy(true);
      try {
        await requestJson("/api/auth/admin-mode", { method: "POST", body: { on: false } });
        toast.success("Admin privileges are off on this device");
        await refreshMe?.();
      } catch (err) {
        toast.error(err.message);
      } finally {
        setAdminBusy(false);
      }
      return;
    }
    const turnedOn = await askPin({
      title: "Turn on Admin Privileges",
      message: "Enter your PIN to confirm it's you.",
      confirmLabel: "Turn on",
      submit: (pin) => requestJson("/api/auth/admin-mode", { method: "POST", body: { on: true, pin } }),
    });
    if (turnedOn) {
      toast.success("Admin privileges are on");
      await refreshMe?.();
    }
  };

  // "Admin notifications": stop the admin-duty notifications (join requests,
  // feedback, promotion requests) without giving up any authority. No PIN.
  const toggleAdminNotifications = async () => {
    if (adminBusy) return;
    setAdminBusy(true);
    try {
      await requestJson("/api/auth/admin-notifications", { method: "POST", body: { enabled: !adminNotifications } });
      toast.success(`Admin notifications are ${adminNotifications ? "off" : "on"}`);
      await refreshMe?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdminBusy(false);
    }
  };

  const topicsPaused = !pushSubscribed;

  return (
    <Modal title="Settings" onClose={onClose} z={50} maxHeight="85vh">
      {/* ---------------------------------------------------------------- */}
      <SectionHeading id="settings-appearance">Appearance</SectionHeading>
      <Switch
        checked={simple}
        onChange={toggleSimple}
        label="Simple mode"
        description="A shorter menu, just three labeled buttons at the top, bigger labels, and messages that stay up longer. Nothing is taken away — Settings and Refresh move into the Menu button, and you can turn Simple mode off any time."
        className="mb-3"
      />
      <p className="text-xs text-inkfaint mt-0 mb-1.5">Theme</p>
      <div className="flex gap-2 mb-4" role="group" aria-label="Theme">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => chooseTheme(t.id)}
            aria-pressed={theme === t.id}
            className={theme === t.id ? "sp-pill-outline active" : "sp-pill-outline"}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-inkfaint mt-0 mb-1.5">Text size — {TEXT_SIZES.find((t) => t.id === textSize)?.label}</p>
      <input
        type="range"
        min="0"
        max={TEXT_SIZES.length - 1}
        step="1"
        value={TEXT_SIZES.findIndex((t) => t.id === textSize)}
        onChange={(e) => chooseTextSize(TEXT_SIZES[Number(e.target.value)].id)}
        aria-label="Text size"
        aria-valuetext={TEXT_SIZES.find((t) => t.id === textSize)?.label}
        className="w-full mb-1"
      />
      <div className="flex justify-between text-[0.625rem] text-inkfaint mb-3" aria-hidden="true">
        <span>A</span>
        <span className="text-base">A</span>
      </div>

      <Switch
        checked={desktopLayout}
        onChange={setDesktopLayout}
        label="Use wide desktop layout on larger screens"
        className="mb-4"
      />

      {/* ---------------------------------------------------------------- */}
      <SectionHeading id="settings-notifications">Notifications</SectionHeading>
      <Switch
        checked={pushSubscribed}
        onChange={togglePush}
        busy={pushBusy}
        label="Push notifications on this device"
        description="Turn this on once per device (phone, laptop, etc.) to receive anything below."
      />

      <p id="settings-topics-note" className="text-xs text-inkfaint mt-3 mb-1">
        {topicsPaused
          ? "Topics are paused because push notifications are off on this device. Turn them on above to choose what you're notified about."
          : "Choose what you're notified about:"}
      </p>
      {prefs === null && !prefsFailed && <p className="text-xs text-inkfaint mb-3">Loading your topics…</p>}
      {prefsFailed && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-3" role="alert">
          Couldn't load your notification topics.{" "}
          <button onClick={loadPrefs} className="underline">
            Try again
          </button>
        </p>
      )}
      {prefs && (
        <div className="mb-4">
          <Switch
            checked={prefs.global}
            onChange={setGlobalPref}
            disabled={topicsPaused}
            describedBy="settings-topics-note"
            label="Church-wide News & Events"
          />
          {prefs.groups?.map((g) => (
            <Switch
              key={g.group_id}
              checked={g.enabled}
              onChange={(next) => setGroupPref(g.group_id, next)}
              disabled={topicsPaused}
              describedBy="settings-topics-note"
              label={g.name}
            />
          ))}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {hasAdminRole && (
        <>
          <SectionHeading id="settings-admin">Admin</SectionHeading>
          <Switch
            checked={Boolean(adminMode)}
            onChange={toggleAdminPrivileges}
            busy={adminBusy}
            label="Use Admin Privileges"
            description={
              adminMode
                ? "On: you can manage ministries, people and settings. Turn it off to use the app like any other member on this device — nothing can be changed by accident, and the admin tools disappear. You stay an admin; turning it back on asks for your PIN."
                : "Off: this device treats you like any other member, and the admin tools are hidden. You're still an admin — turn this on (it asks for your PIN) whenever you need to manage things."
            }
          />
          <Switch
            checked={Boolean(adminNotifications)}
            onChange={toggleAdminNotifications}
            busy={adminBusy}
            label="Admin notifications"
            className="mb-4"
            description={
              adminNotifications
                ? "On: you're notified about new join requests, feedback and promotion requests. Turn it off if you don't want those alerts — you stay an admin with every permission, and anything waiting still shows in the Admin Toolbox."
                : "Off: you won't be notified about join requests, feedback or promotion requests. You're still an admin with every permission, and anything waiting still shows in the Admin Toolbox."
            }
          />
        </>
      )}

      {/* ---------------------------------------------------------------- */}
      <SectionHeading id="settings-about">About</SectionHeading>
      <div className="flex flex-wrap gap-2">
        <button onClick={onOpenHelp} className="sp-btn-secondary">
          Help / FAQ
        </button>
        <button onClick={onOpenPatchNotes} className="sp-btn-secondary relative">
          What's New
          {hasNewPatchNotes && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent border border-card" aria-label="New" />
          )}
        </button>
        <button onClick={onOpenAttribution} className="sp-btn-secondary">
          Sources &amp; Attribution
        </button>
        <button onClick={() => setShowFeedback(true)} className="sp-btn-secondary">
          Send Feedback
        </button>
      </div>

      <p className="text-[0.6875rem] text-inkfaint mt-5 text-center">Version {packageJson.version}</p>
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </Modal>
  );
}

function SectionHeading({ id, children }) {
  return (
    <h3 id={id} className="text-xs uppercase tracking-wide text-inkfaint mt-5 first:mt-0 mb-2 pb-1 border-b border-linesoft">
      {children}
    </h3>
  );
}
