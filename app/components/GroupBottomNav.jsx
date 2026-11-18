"use client";

import { useEffect, useRef, useState } from "react";
import { Megaphone, CalendarDays, Heart, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useSimpleMode } from "@/lib/useSimpleMode";

export const BASE_TABS = [
  { key: "news", label: "News", icon: Megaphone },
  { key: "events", label: "Events", icon: CalendarDays },
];

// Prayer is a bolt-on module (the "prayer" feature), not part of every
// ministry. It sits right after Events when a ministry has turned it on.
export const PRAYER_TAB = { key: "prayer", label: "Prayer", icon: Heart };

export const ROSTER_TAB = { key: "roster", label: "Roster", icon: Users };

// Shown ONLY while inside a group (Choir, a Sunday School class). Replaces
// the universal BottomNav entirely -- per the project's decision, being
// inside a sub-app shows only that sub-app's tabs. Getting back to
// News/Events/Hub/Bible means leaving the group via "Back to Hub."
//
// prependTabs lead the nav (e.g. Today/Plan/Journal for a reading-plan
// group); appendTabs follow the shared set but come before Roster (e.g.
// Songs/Setlists for Choir). Roster is always last.
export default function GroupBottomNav({ tab, setTab, prependTabs = [], appendTabs = [], badges = {}, hasPrayer = false }) {
  const tabs = [...prependTabs, ...BASE_TABS, ...(hasPrayer ? [PRAYER_TAB] : []), ...appendTabs, ROSTER_TAB];
  // Simple mode (v71): bigger icons and words. Nothing is hidden inside a
  // ministry -- a choir member still needs Songs and Setlists.
  const simple = useSimpleMode();

  // When the tabs don't all fit, the row scrolls sideways. A soft fade on
  // whichever edge has more tabs past it says "there's more this way": the
  // right fade shows while tabs remain to the right, the left fade appears
  // once you've scrolled past the first tab. Takes no extra space.
  const scrollRef = useRef(null);
  const [fade, setFade] = useState({ left: false, right: false, nLeft: 0, nRight: 0 });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      // How many tabs sit (mostly) past each edge, for the little count.
      const box = el.getBoundingClientRect();
      let nLeft = 0;
      let nRight = 0;
      for (const b of el.querySelectorAll("button")) {
        const r = b.getBoundingClientRect();
        const mid = r.left + r.width / 2;
        if (mid > box.right - 28) nRight++;
        else if (mid < box.left + 28) nLeft++;
      }
      setFade((f) => {
        const next = { left: el.scrollLeft > 2, right: el.scrollLeft < max - 2, nLeft, nRight };
        return f.left === next.left && f.right === next.right && f.nLeft === nLeft && f.nRight === nRight ? f : next;
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [tabs.length, simple]);

  // Keep the current tab in view (e.g. arriving on Roster, the last tab).
  useEffect(() => {
    const el = scrollRef.current?.querySelector('[aria-current="page"]');
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab]);

  // v71.29: the fade alone was too easy to miss, so each edge with more tabs
  // past it also shows a round arrow button (tap it to scroll that way) and
  // how many tabs are hidden on that side.
  const fadeBase = "absolute top-0 bottom-0 w-14 z-10 flex items-center transition-opacity duration-150 motion-reduce:transition-none";
  const scrollBy = (dir) => {
    const el = scrollRef.current;
    el?.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };
  const arrow = (side) => {
    const n = side === "right" ? fade.nRight : fade.nLeft;
    const Icon = side === "right" ? ChevronRight : ChevronLeft;
    return (
      <button
        type="button"
        tabIndex={-1}
        onClick={() => scrollBy(side === "right" ? 1 : -1)}
        aria-label={`${n || "More"} more ${n === 1 ? "tab" : "tabs"} ${side === "right" ? "to the right" : "to the left"}`}
        className={`relative w-7 h-7 rounded-full bg-accent text-white shadow-md flex items-center justify-center ${side === "right" ? "nhag-more-tabs" : ""}`}
      >
        <Icon size={16} strokeWidth={2.5} aria-hidden="true" />
        {n > 0 && (
          <span className={`absolute -top-1.5 ${side === "right" ? "-left-1.5" : "-right-1.5"} min-w-[1rem] h-4 px-1 rounded-full bg-card text-accent border border-accent text-[0.5625rem] font-bold leading-[0.875rem] text-center`}>
            {n}
          </span>
        )}
      </button>
    );
  };
  return (
    <nav aria-label="Ministry" className="md:hidden sticky bottom-0 z-30 bg-card border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className={`${fadeBase} left-0 justify-start pl-2 bg-gradient-to-r from-card from-40% to-card/0 ${fade.left ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        {fade.left && arrow("left")}
      </div>
      <div className={`${fadeBase} right-0 justify-end pr-2 bg-gradient-to-l from-card from-40% to-card/0 ${fade.right ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        {fade.right && arrow("right")}
      </div>
      <div ref={scrollRef} className="overflow-x-auto px-2 pt-1.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex justify-between gap-1">
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={active ? "page" : undefined}
              className={`flex-1 flex flex-col items-center gap-1 py-1.5 px-2 ${simple ? "min-w-[76px] min-h-[60px] justify-center" : "min-w-[64px]"}`}
            >
              <span className="relative">
                {Icon && <Icon size={simple ? 26 : 19} strokeWidth={active ? 2.3 : 1.8} className={active ? "text-accent" : "text-inkfaint"} />}
                {badges[key] && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent border border-card" />
                )}
              </span>
              <span className={`${simple ? "text-[0.8125rem]" : "text-[0.625rem]"} font-medium whitespace-nowrap ${active ? "text-accent" : "text-inkfaint"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
      </div>
    </nav>
  );
}
