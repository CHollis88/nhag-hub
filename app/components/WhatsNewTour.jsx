"use client";

import { useState } from "react";
import { Heart, Camera, BookOpen, Sparkles, ChevronRight, ChevronLeft, ListChecks } from "lucide-react";
import { markTourSeen } from "@/lib/onboarding";

// v72: a one-time "What's new" tour the first time each person opens
// 72.0 -- it covers the 71.29 features too, since most people won't have
// noticed them yet. Swipe or tap through; every card has "Try it", which
// goes straight there. Brand-new accounts get the setup walkthrough instead.

const CARDS = [
  { icon: Heart, title: "Church Prayer", body: "A prayer page for the whole church. Share a request (anonymously if you like), and tap “I'm praying” on others'. It's the heart tile next to your ministries.", go: "church-prayer" },
  { icon: Camera, title: "Profile photos", body: "Add a photo so people in your ministries know who's who. It's optional.", go: "profile" },
  { icon: BookOpen, title: "More Bibles, and a daily verse", body: "The New King James (NKJV) and Amplified (AMP) are here, for six translations in all. And there's a new Verse of the Day at the top of Home.", go: "bible-picker" },
  { icon: ListChecks, title: "Finish setting up", body: "A short checklist on Home walks you through anything you haven't set up yet. Not interested in one? Tap the X and it's gone.", go: null },
  { icon: Sparkles, title: "Did you know?", body: "Every few days, Home shows one helpful feature you might not have found yet. Tap “Show me” to try it.", go: null },
];

export default function WhatsNewTour({ onClose, onGo }) {
  const [i, setI] = useState(0);
  const [touchX, setTouchX] = useState(null);
  const card = CARDS[i];
  const last = i === CARDS.length - 1;

  const close = () => {
    markTourSeen();
    onClose?.();
  };
  const go = (where) => {
    markTourSeen();
    onGo?.(where);
  };
  const onTouchEnd = (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (dx < -50 && !last) setI(i + 1);
    if (dx > 50 && i > 0) setI(i - 1);
    setTouchX(null);
  };
  const Icon = card.icon;

  return (
    <div className="fixed inset-0 z-[74] bg-black/50 flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-label="What's new in NHAG">
      <div
        className="bg-paper w-full md:max-w-md rounded-t-3xl md:rounded-3xl overflow-hidden pb-[env(safe-area-inset-bottom)]"
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={onTouchEnd}
      >
        <div className="nhag-welcome text-white px-6 pt-6 pb-8 text-center relative">
          <button type="button" onClick={close} className="absolute top-3 right-4 text-sm text-[#c9d2ee] underline">
            Skip
          </button>
          <p className="text-xs uppercase tracking-widest text-[#c9d2ee] mb-4">What&apos;s new in NHAG</p>
          <span key={i} className="nhag-tour-icon mx-auto w-20 h-20 rounded-3xl bg-white text-accent flex items-center justify-center shadow-lg">
            <Icon size={40} aria-hidden="true" />
          </span>
        </div>
        <div className="px-6 pt-5 pb-6 min-h-[13rem] flex flex-col">
          <h2 className="font-serif text-2xl text-ink text-center">{card.title}</h2>
          <p className="text-base text-inksoft text-center mt-2 flex-1">{card.body}</p>
          {card.go && (
            <button type="button" onClick={() => go(card.go)} className="mt-4 mx-auto text-sm font-semibold text-accent underline">
              Try it now
            </button>
          )}
        </div>
        <div className="px-6 pb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setI(i - 1)}
            disabled={i === 0}
            className="w-11 h-11 rounded-full border border-line flex items-center justify-center text-ink disabled:opacity-30"
            aria-label="Previous"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 flex justify-center gap-1.5" aria-label={`${i + 1} of ${CARDS.length}`}>
            {CARDS.map((_, n) => (
              <span key={n} className={`h-2 rounded-full transition-all ${n === i ? "w-5 bg-accent" : "w-2 bg-line"}`} />
            ))}
          </div>
          {last ? (
            <button type="button" onClick={close} className="h-11 px-5 rounded-full bg-accent text-white font-semibold">
              Done
            </button>
          ) : (
            <button type="button" onClick={() => setI(i + 1)} className="w-11 h-11 rounded-full bg-accent text-white flex items-center justify-center" aria-label="Next">
              <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
