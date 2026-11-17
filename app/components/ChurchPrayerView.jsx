"use client";

import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import GroupPrayerTab from "./GroupPrayerTab";
import { markSeen } from "@/lib/lastSeen";
import { invalidate } from "@/lib/resourceCache";
import { CHURCH_PRAYER_SEEN } from "./HomeCards";

// Church Prayer (v71.29): the whole church's prayer requests, opened from
// Home's Church prayer card. Same list and controls as a ministry's Prayer
// tab, pointed at the church-wide routes. Nobody is notified when a request
// is added -- people see new ones from the dot on Home.
export default function ChurchPrayerView({ isAdmin, onClose }) {
  useEffect(() => {
    markSeen(CHURCH_PRAYER_SEEN);
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      markSeen(CHURCH_PRAYER_SEEN);
      invalidate("home:events-mine"); // Home's count/preview reflect what changed here
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-paper" role="dialog" aria-modal="true" aria-label="Church prayer">
      <header
        className="flex items-center gap-2 px-3 py-2.5 bg-[#132560] text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.625rem)" }}
      >
        <button type="button" onClick={onClose} className="flex items-center gap-1 text-sm px-1 py-1" aria-label="Back to Home">
          <ArrowLeft size={18} aria-hidden="true" /> Home
        </button>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <GroupPrayerTab
          apiBase="/api/church-prayer"
          cacheKey="church-prayer:list"
          postType="global_prayer"
          showNotify={false}
          canManage={isAdmin}
          title="Church Prayer"
          intro="Share what's on your heart, and pray for one another. Nobody gets a notification when you post."
        />
      </main>
    </div>
  );
}
