"use client";

import { useState } from "react";
import { Bell, X } from "lucide-react";
import { subscribeToPush } from "@/lib/pushClient";

const DISMISS_KEY = "sp_push_dismissed";

export default function NotifyBanner({ onDone, onInstallHelp }) {
  const [status, setStatus] = useState("idle"); // idle | asking | done | denied | unsupported

  const enable = async () => {
    setStatus("asking");
    const result = await subscribeToPush();
    if (result.ok) setStatus("done");
    else if (result.reason === "denied") setStatus("denied");
    else setStatus("unsupported");
    if (result.ok || result.reason === "denied" || !onInstallHelp) setTimeout(onDone, result.ok ? 1200 : 2200);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    onDone();
  };

  return (
    <div className="mx-5 mt-3 mb-1 bg-navy text-white rounded-xl px-4 py-3.5 flex items-start gap-3">
      <Bell size={18} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        {status === "idle" && (
          <>
            <p className="text-sm font-medium mb-2">Get News, Events, and Sermon updates?</p>
            <div className="flex gap-2">
              <button onClick={enable} className="bg-white text-navy rounded-full px-3.5 py-1.5 text-xs font-semibold">
                Turn on
              </button>
              <button onClick={dismiss} className="text-[#b9c3e6] text-xs px-2">
                Not now
              </button>
            </div>
          </>
        )}
        {status === "asking" && <p className="text-sm">Requesting permission...</p>}
        {status === "done" && <p className="text-sm">Notifications on. 🎉</p>}
        {status === "denied" && (
          <p className="text-sm">
            No worries — you can turn these on later from your phone's notification settings.
          </p>
        )}
        {status === "unsupported" && (
          <div>
            <p className="text-sm">Notifications need the app on your home screen first.</p>
            {onInstallHelp && (
              <button onClick={() => { onDone(); onInstallHelp(); }} className="mt-2 bg-white text-navy rounded-full px-3.5 py-1.5 text-xs font-semibold">
                Show me how
              </button>
            )}
          </div>
        )}
      </div>
      <button onClick={dismiss} className="text-[#b9c3e6] flex-shrink-0">
        <X size={16} />
      </button>
    </div>
  );
}

export function shouldShowNotifyBanner() {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(DISMISS_KEY)) return false;
  if (typeof Notification === "undefined") return false;
  return Notification.permission === "default";
}
