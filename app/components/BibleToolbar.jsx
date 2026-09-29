"use client";

import { ChevronLeft, ChevronRight, ChevronDown, Volume2, Ear, Search, Type, Columns2, ToggleLeft, ToggleRight, AlignLeft, Check } from "lucide-react";

// v71 #27 -- the Bible reader's toolbar.
//
// Locked decision: EVERY reader tool stays visible on the toolbar -- none of
// them is ever moved into a "More" menu. The design goal is that it costs as
// little of the screen as possible, because the reading is what matters:
//
//   STICKY (stays at the top while you read) -- the things you use again and
//   again, kept slim:
//     1. previous / chapter / next  -- one thin row
//     2. the four reader tools      -- Listen, Word tap, Find, Font: a 4-column
//        grid that can never wrap, each an icon with a short word under it, and
//        a check mark (not just a colour) on a tool that is switched on
//   NOT STICKY (scrolls away with the text) -- the set-and-forget choices:
//     3. translation, layout, KJV compare, Study/Simple
//
// A line for screen readers always says what's showing ("NLT · Study"); the
// translation and Study/Simple buttons on row 3 show the same thing to the eye.
// Presentational only: PassageReader owns all the state and passes it in.
function Tool({ icon: Icon, label, onClick, active = false, ariaLabel, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      title={title}
      className={`relative min-h-[42px] min-w-0 rounded-lg px-1 py-1 flex flex-col items-center justify-center gap-0.5 text-center border
        ${active ? "border-accent bg-accent/10 text-accent" : "border-line bg-paper text-inkfaint"}`}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="text-[0.6875rem] leading-none font-medium break-words max-w-full">{label}</span>
      {active && <Check size={10} strokeWidth={3} className="absolute top-0.5 right-0.5" aria-hidden="true" />}
    </button>
  );
}

const pill = "flex items-center gap-1.5 rounded-full px-3 min-h-[36px] text-xs font-medium border";

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
  const modeLabel = studyMode ? "Study" : "Simple";
  const arrow = "h-8 w-9 flex items-center justify-center text-inkfaint flex-shrink-0 disabled:opacity-30";
  return (
    <>
      <div className="sticky top-0 z-20 bg-paper pt-1 pb-1 -mx-5 px-5 md:mx-0 md:px-0" data-testid="bible-toolbar-sticky">
        {/* Row 1 -- where you are: one THIN row (32px tall) */}
        <div className="flex items-center gap-1 mb-1">
          <button type="button" onClick={onPrev} disabled={!canGoPrev} className={arrow} aria-label="Previous chapter">
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onOpenBookPicker}
            className="flex-1 min-w-0 h-8 px-2 rounded-lg border border-line bg-card text-sm text-ink flex items-center justify-center gap-1"
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

        {/* Row 2 -- the reader tools: all four, always visible, one row */}
        <div className="grid grid-cols-4 gap-1" role="toolbar" aria-label="Reader tools">
          <Tool icon={Volume2} label="Listen" ariaLabel="Listen to this chapter" active={chapterPlaying} onClick={onListen} />
          <Tool
            icon={Ear}
            label="Word tap"
            ariaLabel="Tap a word to hear it"
            title={wordTapMode ? "Tap-a-word is on" : "Tap-a-word is off"}
            active={wordTapMode}
            onClick={onToggleWordTap}
          />
          <Tool icon={Search} label="Find" ariaLabel="Jump to a reference or find in this chapter" onClick={onFind} />
          <Tool icon={Type} label="Font" ariaLabel="Change reading font" onClick={onFont} />
        </div>
      </div>

      {/* Row 3 -- translation and view. Set once and left alone, so it scrolls
          away with the text instead of covering the screen. Translation stays
          FIRST so it doesn't move when the others come and go. */}
      <div className="flex items-center gap-1.5 mt-1 mb-1 flex-wrap" data-testid="bible-toolbar-modes">
        <button type="button" onClick={onTranslation} className={`${pill} bg-paper text-inkfaint border-line`}>
          {translationLabel}
          <ChevronDown size={12} className="opacity-60" aria-hidden="true" />
        </button>
        {showLayout && (
          <button type="button" onClick={onLayout} className={`${pill} bg-paper text-inkfaint border-line`}>
            <LayoutIcon size={14} aria-hidden="true" />
            {layoutLabel || "Layout"}
            <ChevronDown size={12} className="opacity-60" aria-hidden="true" />
          </button>
        )}
        {showCompare && (
          <button
            type="button"
            onClick={onToggleCompare}
            aria-pressed={compareOn}
            className={`${pill} ${compareOn ? "bg-accent/10 text-accent border-accent/40" : "bg-paper text-inkfaint border-line"}`}
            title={compareOn ? "Showing KJV alongside. Tap to hide." : "Show the KJV alongside"}
          >
            <Columns2 size={14} aria-hidden="true" />
            KJV
            {compareOn && <Check size={10} strokeWidth={3} aria-hidden="true" />}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleStudy}
          aria-pressed={studyMode}
          className={`${pill} bg-paper text-inkfaint border-line ml-auto`}
          title={studyMode ? "Showing study tools. Tap to simplify." : "Simplified view. Tap for study tools."}
        >
          {studyMode ? <ToggleRight size={16} className="text-accent" aria-hidden="true" /> : <ToggleLeft size={16} aria-hidden="true" />}
          {modeLabel}
        </button>
        {/* For screen readers: what's showing, announced when it changes. */}
        <p role="status" className="sr-only" data-testid="bible-mode-indicator">
          {translationLabel} · {modeLabel}
        </p>
      </div>
    </>
  );
}
