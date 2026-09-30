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
// a "More" menu -- and none carries a text label (icons only; the name is in
// aria-label and the title) EXCEPT the translation, which always shows its
// abbreviation ("KJV", "NLT") so you can see which Bible you are in. Two layouts, chosen by how much ROOM THE TOOLBAR
// ITSELF has (not the window: in the two-pane desktop layout the reader sits in
// a narrower pane):
//   ROOMY (>= WIDE_MIN_PX): chapter nav + all tools on ONE row.
//   NARROW (a phone): a chapter nav row, then all tools on ONE equal-width row.
//
// A tool that is switched on shows a check mark, not just a colour. A line for
// screen readers always says what's showing ("NLT · Study"). Presentational only:
// PassageReader owns all the state and passes it in.
export const WIDE_MIN_PX = 880;

// One icon-only reader control. No text label: the name lives in aria-label and
// the hover/long-press title. A control that is switched on shows a check mark.
function IconBtn({ icon: Icon, iconClass = "", onClick, active, ariaLabel, title, chevron = false, fill = false, text }) {
  const on = active === true;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active === undefined ? undefined : active}
      aria-label={ariaLabel}
      title={title || ariaLabel}
      className={`relative h-9 flex items-center justify-center gap-0.5 rounded-lg border min-w-0
        ${text ? "px-1.5 flex-shrink-0 text-xs font-medium" : fill ? "flex-1" : "w-10 flex-shrink-0"}
        ${on ? "border-accent/50 bg-accent/10 text-accent" : "border-line bg-paper text-inkfaint"}`}
    >
      <Icon size={18} className={iconClass} aria-hidden="true" />
      {text && <span className="whitespace-nowrap">{text}</span>}
      {chevron && <ChevronDown size={10} className="opacity-60" aria-hidden="true" />}
      {on && <Check size={10} strokeWidth={3} className="absolute top-0.5 right-0.5" aria-hidden="true" />}
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

  const arrow = "h-8 w-9 flex items-center justify-center text-inkfaint flex-shrink-0 disabled:opacity-30";
  const nav = (
    <div className={wide ? "flex items-center gap-1 flex-shrink-0" : "flex items-center gap-1 mb-1"}>
      <button type="button" onClick={onPrev} disabled={!canGoPrev} className={arrow} aria-label="Previous chapter">
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onOpenBookPicker}
        className={`${wide ? "w-36" : "flex-1 min-w-0"} h-8 px-2 rounded-lg border border-line bg-card text-sm text-ink flex items-center justify-center gap-1`}
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
    translation: { icon: Languages, label: translationLabel, text: translationLabel, ariaLabel: translationName, title: `Translation: ${translationLabel} (tap to change)`, onClick: onTranslation, chevron: true },
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
  const all = [controls.listen, controls.wordTap, controls.find, controls.translation, ...extras];

  return (
    <>
      <div
        ref={stickyRef}
        className="sticky top-0 z-20 bg-paper pt-1 pb-1 -mx-5 px-5 md:mx-0 md:px-0"
        data-testid="bible-toolbar-sticky"
        data-layout={wide ? "wide" : "narrow"}
      >
        {wide ? (
          // ROOMY: chapter nav and every tool on one row.
          <div className="flex items-center gap-x-3 flex-nowrap">
            {nav}
            <div className="flex items-center gap-1.5" role="toolbar" aria-label="Reader tools">
              {all.map((c) => <IconBtn key={c.ariaLabel} {...c} />)}
            </div>
          </div>
        ) : (
          // NARROW: nav row, then every tool on one equal-width row.
          <>
            {nav}
            <div className="flex items-center gap-1" role="toolbar" aria-label="Reader tools">
              {all.map((c) => <IconBtn key={c.ariaLabel} fill {...c} />)}
            </div>
          </>
        )}
      </div>

      {/* For screen readers: what's showing, announced when it changes. */}
      <p role="status" className="sr-only" data-testid="bible-mode-indicator">
        {translationLabel} · {modeLabel}
      </p>
    </>
  );
}
