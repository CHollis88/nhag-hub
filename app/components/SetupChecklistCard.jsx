"use client";

import { useEffect, useState } from "react";
import { ListChecks, ChevronRight, X } from "lucide-react";
import { isSubscribedToPush } from "@/lib/pushClient";
import { checklistItems, declineItem } from "@/lib/onboarding";

// v72 "Finish setting up" on Home, for EVERYONE (existing members too):
// only the setup items this person hasn't done or turned down. Each button
// goes straight to the spot (the photo picker, the install guide, the
// notification permission box...). Items tick themselves off when actually
// done. "No thanks" removes an item for good. Compact: the next item, with
// the rest one tap away, so Home's other cards still fit on screen.

const ALL_SET_KEY = "nhag_setup_all_set_shown";

export default function SetupChecklistCard({ me, onAction }) {
  const [subscribed, setSubscribed] = useState(null); // null = still checking
  const [expanded, setExpanded] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    let alive = true;
    const check = () => isSubscribedToPush().then((v) => alive && setSubscribed(v));
    check();
    const onVis = () => document.visibilityState === "visible" && (check(), bump((n) => n + 1));
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("nhag-onboarding-changed", onVis);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("nhag-onboarding-changed", onVis);
    };
  }, []);

  if (subscribed === null) return null;
  const items = checklistItems(me, { subscribed });
  const open = items.filter((i) => !i.done);
  const doneCount = items.length - open.length;

  if (items.length === 0) return null;
  if (open.length === 0) {
    // Celebrate once, the visit they finish; then the card is gone.
    let shown = false;
    try {
      shown = Boolean(localStorage.getItem(ALL_SET_KEY));
      if (!shown) localStorage.setItem(ALL_SET_KEY, "1");
    } catch {
      shown = true;
    }
    if (shown) return null;
    return (
      <div className="sp-card mb-4 py-3 text-sm text-ink flex items-center gap-2">
        <span aria-hidden="true">🎉</span> You&apos;re all set up. Thanks!
      </div>
    );
  }

  const decline = (id) => {
    declineItem(id);
    bump((n) => n + 1);
  };
  const shownItems = expanded ? open : open.slice(0, 1);

  return (
    <div className="sp-card mb-4 p-0 overflow-hidden" role="region" aria-label="Finish setting up">
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink flex items-center gap-1.5">
            <ListChecks size={16} className="text-accent" aria-hidden="true" /> Finish setting up
          </p>
          <span className="text-xs text-inkfaint">{doneCount} of {items.length} done</span>
        </div>
        <div className="h-1.5 rounded-full bg-linesoft mt-2 overflow-hidden" aria-hidden="true">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(doneCount / items.length) * 100}%` }} />
        </div>
      </div>
      <ul className="divide-y divide-linesoft border-t border-linesoft">
        {shownItems.map((i) => (
          <li key={i.id} className="flex items-center gap-2 pl-4 pr-2 py-2.5">
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-ink">{i.title}</span>
              <span className="block text-xs text-inksoft truncate">{i.body}</span>
            </span>
            <button type="button" onClick={() => onAction(i.id)} className="flex-shrink-0 bg-accent text-white rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-0.5">
              {i.cta} <ChevronRight size={13} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => decline(i.id)} className="flex-shrink-0 p-1.5 text-inkfaint" aria-label={`No thanks: ${i.title}`} title="No thanks">
              <X size={15} />
            </button>
          </li>
        ))}
      </ul>
      {open.length > 1 && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="w-full text-xs text-accent font-medium py-2 border-t border-linesoft">
          {expanded ? "Show less" : `Show ${open.length - 1} more`}
        </button>
      )}
    </div>
  );
}
