"use client";

import { useRef } from "react";
import {
  ChevronLeft, ChevronRight, ChevronDown, Volume2, Ear, Search, Type, Languages, Columns2,
  ToggleLeft, ToggleRight, AlignLeft, Check,
} from "lucide-react";
import { useElementWidth } from "@/lib/useElementWidth";

// v71 #27 -- the Bible reader's toolbar.
//
// Locked decision: EVERY reader control stays visible -- none is ever moved into
// a "More" menu. The goal is that it costs as little of the screen as possible,
// because the reading is what matters. It has two layouts, chosen by how much
// ROOM THE TOOLBAR ITSELF has (not by the size of the window: in the app's
// two-pane desktop layout the reader sits in a narrower pane):
//
//   ROOMY (at least WIDE_MIN_PX wide) -- everything on ONE thin sticky row:
//     chapter nav | Listen  Word tap  Find  Translation | Font  Layout  KJV  Study
//
//   NARROW (a phone) -- two layers:
//     STICKY (stays put while you read): a thin chapter nav row, then four tools
//       -- Listen, Word tap, Find and the current TRANSLATION (it shows which
//       Bible you're in, like "NLT", so it's always visible) -- each an icon with
//       a short word under it, in a 4-column grid that can never wrap.
//     NOT STICKY (scrolls away with the text): Font, Layout, KJV compare and
//       Study/Simple -- things you set and leave.
//
// A tool that is switched on shows a check mark, not just a colour. A line for
// screen readers always says what's showing ("NLT · Study"). Presentational only:
// PassageReader owns all the state and passes it in.
export const WIDE_MIN_PX = 880;

// A phone-layout tool: icon with a short word under it.
function Tool({ icon: Icon, label, onClick, active, ariaLabel, title }) {
  const on = active === true;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active === undefined ? undefined : active}
      aria-label={ariaLabel}
      title={title}
      className={`relative min-h-[42px] min-w-0 rounded-lg px-1 py-1 flex flex-col items-center justify-center gap-0.5 text-center border
        ${on ? "border-accent bg-accent/10 text-accent" : "border-line bg-paper text-inkfaint"}`}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="text-[0.6875rem] leading-none font-medium break-words max-w-full">{label}</span>
      {on && <Check size={10} strokeWidth={3} className="absolute top-0.5 right-0.5" aria-hidden="true" />}
    </button>
  );
}

// A chip: icon and word side by side. Used for the one-row layout and for the
// scroll-away row on a phone.
function Chip({ icon: Icon, iconClass = "", label, onClick, active, ariaLabel, title, chevron = false, slim = false }) {
  const on = active === true;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active === undefined ? undefined : active}
      aria-label={ariaLabel}
      title={title}
      className={`flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap rounded-lg border px-2.5 text-xs font-medium ${slim ? "h-8" : "h-9"}
        ${on ? "border-accent/50 bg-accent/10 text-accent" : "border-line bg-paper text-inkfaint"}`}
    >
      {Icon && <Icon size={14} className={iconClass} aria-hidden="true" />}
      {label}
      {chevron && <ChevronDown size={12} className="opacity-60" aria-hidden="true" />}
      {on && <Check size={10} strokeWidth={3} aria-hidden="true" />}
    </button>
  );
}

export default function BibleToolbar({
  bookName,
  chapter,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onOpenBookPicker,
  chapterPlaying,
  onListen,
  wordTapMode,
  onToggleWordTap,
  onFind,
  onFont,
  translationLabel,
  onTranslation,
  showLayout,
  layoutLabel,
  LayoutIcon = AlignLeft,
  onLayout,
  showCompare,
  compareOn,
  onToggleCompare,
  studyMode,
  onToggleStudy,
}) {
  const stickyRef = useRef(null);
  const wide = useElementWidth(stickyRef) >= WIDE_MIN_PX;
  const modeLabel = studyMode ? "Study" : "Simple";
  const slim = wide;

  const arrow = "h-8 w-9 flex items-center justify-center text-inkfaint flex-shrink-0 disabled:opacity-30";
  const nav = (
    <div className={wide ? "flex items-center gap-1 flex-shrink-0" : "flex items-center gap-1 mb-1"}>
      <button type="button" onClick={onPrev} disabled={!canGoPrev} className={arrow} aria-label="Previous chapter">
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onOpenBookPicker}
        className={`${wide ? "w-44" : "flex-1 min-w-0"} h-8 px-2 rounded-lg border border-line bg-card text-sm text-ink flex items-center justify-center gap-1`}
      >
        <span className="truncate">
          {bookName} {chapter}
        </span>
        <ChevronDown size={14} className="opacity-60 flex-shrink-0" aria-hidden="true" />
      </button>
      <button type="button" onClick={onNext} disabled={!canGoNext} className={arrow} aria-label="Next chapter">
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  );

  // The controls, described once and drawn either way.
  const translationName = `Translation: ${translationLabel}. Tap to change.`;
  const controls = {
    listen: { icon: Volume2, label: "Listen", ariaLabel: "Listen to this chapter", active: chapterPlaying, onClick: onListen },
    wordTap: {
      icon: Ear,
      label: "Word tap",
      ariaLabel: "Tap a word to hear it",
      title: wordTapMode ? "Tap-a-word is on" : "Tap-a-word is off",
      active: wordTapMode,
      onClick: onToggleWordTap,
    },
    find: { icon: Search, label: "Find", ariaLabel: "Jump to a reference or find in this chapter", onClick: onFind },
    translation: { icon: Languages, label: translationLabel, ariaLabel: translationName, title: "Change translation", onClick: onTranslation, chevron: true },
    font: { icon: Type, label: "Font", ariaLabel: "Change reading font", onClick: onFont },
    layout: { icon: LayoutIcon, label: layoutLabel || "Layout", ariaLabel: `Reading layout: ${layoutLabel || "Layout"}. Tap to change.`, onClick: onLayout, chevron: true },
    compare: {
      icon: Columns2,
      label: "KJV",
      ariaLabel: compareOn ? "Showing the KJV alongside. Tap to hide." : "Show the KJV alongside",
      title: compareOn ? "Showing KJV alongside. Tap to hide." : "Show the KJV alongside",
      active: compareOn,
      onClick: onToggleCompare,
    },
    study: {
      icon: studyMode ? ToggleRight : ToggleLeft,
      iconClass: studyMode ? "text-accent" : "",
      label: modeLabel,
      ariaLabel: modeLabel,
      title: studyMode ? "Showing study tools. Tap to simplify." : "Simplified view. Tap for study tools.",
      active: studyMode,
      onClick: onToggleStudy,
    },
  };
  const extras = [controls.font, ...(showLayout ? [controls.layout] : []), ...(showCompare ? [controls.compare] : []), controls.study];
  const chip = (c, key) => <Chip key={key} slim={slim} {...c} />;

  return (
    <>
      <div
        ref={stickyRef}
        className="sticky top-0 z-20 bg-paper pt-1 pb-1 -mx-5 px-5 md:mx-0 md:px-0"
        data-testid="bible-toolbar-sticky"
        data-layout={wide ? "wide" : "narrow"}
      >
        {wide ? (
          // ROOMY: everything on one thin row.
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            {nav}
            <div className="flex items-center gap-1.5 flex-wrap" role="toolbar" aria-label="Reader tools">
              {chip(controls.listen, "listen")}
              {chip(controls.wordTap, "wordTap")}
              {chip(controls.find, "find")}
              {chip(controls.translation, "translation")}
              {extras.map((c) => chip(c, c.ariaLabel))}
            </div>
          </div>
        ) : (
          // NARROW: thin nav, then the four tools that stay in view.
          <>
            {nav}
            <div className="grid grid-cols-4 gap-1" role="toolbar" aria-label="Reader tools">
              <Tool {...controls.listen} />
              <Tool {...controls.wordTap} />
              <Tool {...controls.find} />
              <Tool {...controls.translation} label={translationLabel} />
            </div>
          </>
        )}
      </div>

      {/* NARROW only: the set-and-forget controls scroll away with the text. */}
      {!wide && (
        <div className="flex items-center gap-1.5 mt-1 mb-1 flex-wrap" data-testid="bible-toolbar-modes">
          {extras.map((c) => chip(c, c.ariaLabel))}
        </div>
      )}

      {/* For screen readers: what's showing, announced when it changes. */}
      <p role="status" className="sr-only" data-testid="bible-mode-indicator">
        {translationLabel} · {modeLabel}
      </p>
    </>
  );
}
