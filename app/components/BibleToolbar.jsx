"use client";

import { ChevronLeft, ChevronRight, ChevronDown, Volume2, Ear, Search, Type, Columns2, ToggleLeft, ToggleRight, AlignLeft, Check } from "lucide-react";

// v71 #27 -- the Bible reader's toolbar.
//
// Locked decision: EVERY reader tool stays visible on the toolbar -- none of
// them is ever moved into a "More" menu. What changed is that they now fit and
// explain themselves:
//   * three rows with a fixed job each: (1) previous / chapter / next,
//     (2) the four reader tools, (3) translation and view modes;
//   * the tools are ONE row that never wraps: a 4-column grid, each cell an icon
//     with a short word underneath (Listen, Word tap, Find, Font), and a label
//     that may take two lines rather than overflow, so it holds at the largest
//     text-size setting (sizes are rem, so they grow with it);
//   * a tool that is ON (Listen playing, Word tap) says so with a check mark and
//     a filled outline, not just a colour, and announces itself as pressed;
//   * one line always says what's active: "NLT · Study".
// Presentational only: PassageReader owns all the state and passes it in.
function Tool({ icon: Icon, label, onClick, active = false, ariaLabel, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      title={title}
      className={`relative min-h-[56px] min-w-0 rounded-xl px-1 py-1.5 flex flex-col items-center justify-center gap-1 text-center border
        ${active ? "border-accent bg-accent/10 text-accent" : "border-line bg-paper text-inkfaint"}`}
    >
      <Icon size={20} aria-hidden="true" />
      <span className="text-[0.6875rem] leading-tight font-medium break-words max-w-full">{label}</span>
      {active && <Check size={10} strokeWidth={3} className="absolute top-1 right-1" aria-hidden="true" />}
    </button>
  );
}

const pill = "flex items-center gap-1.5 rounded-full px-3 min-h-[44px] text-xs font-medium border";

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
  return (
    <div className="sticky top-0 z-20 bg-paper pt-1 pb-1 -mx-5 px-5 md:mx-0 md:px-0">
      {/* Row 1 -- where you are */}
      <div className="flex items-center gap-1.5 mb-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canGoPrev}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-inkfaint flex-shrink-0 disabled:opacity-30"
          aria-label="Previous chapter"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onOpenBookPicker}
          className="sp-input text-sm flex items-center justify-center gap-1.5 flex-1 min-w-0 min-h-[44px]"
        >
          <span className="truncate">
            {bookName} {chapter}
          </span>
          <ChevronDown size={14} className="opacity-60 flex-shrink-0" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-inkfaint flex-shrink-0 disabled:opacity-30"
          aria-label="Next chapter"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Row 2 -- the reader tools: all four, always visible, one row */}
      <div className="grid grid-cols-4 gap-1.5 mb-2" role="toolbar" aria-label="Reader tools">
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

      {/* Row 3 -- translation and view. Translation stays FIRST so it doesn't
          move under your thumb when the layout button comes and goes. */}
      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
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
      </div>

      {/* What's on right now, in words. */}
      <p role="status" className="text-[0.6875rem] text-inkfaint mt-0 mb-1" data-testid="bible-mode-indicator">
        {translationLabel} · {modeLabel}
      </p>
    </div>
  );
}
