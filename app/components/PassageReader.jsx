"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ChevronLeft,
  AlignLeft,
  BookOpen,
  Rows,
  Columns2,
  X,
  MousePointerClick,
  Link2,
  Highlighter,
  StickyNote,
  Trash2,
  FileText,
  Copy,
  Check,
  Tag,
  Play,
  Pause,
  Square,
} from "lucide-react";
import { BOOKS, ABBR_TO_NAME, adjacentChapter, formatReference, parseQuickReference, tokensToText } from "@/lib/bibleRef";
import RichContent, { TyndaleAttribution } from "./RichContent";
import BibleToolbar from "./BibleToolbar";
import { scrollBehavior } from "@/lib/motion";
import { getSimpleMode } from "@/lib/simpleMode";
import { TRANSLATIONS, DEFAULT_TRANSLATION, getTranslation, translationCapabilityText } from "@/lib/bibleTranslations";
import { addRecentPassage, getRecentPassages } from "@/lib/recentPassages";
import { getDesktopMode } from "@/lib/desktopMode";
import { api } from "@/lib/api";
import StudyPopup from "./StudyPopup";
import InfoTooltip from "./InfoTooltip";
import { cleanOccurrences } from "@/lib/lexiconFormat";
import { tagColorClass } from "@/lib/tagColor";
import { useAction } from "./useAction";
import { ReaderSkeleton, PopupSkeleton } from "./Skeleton";

const FONT_OPTIONS = [
  { id: "sans", label: "Sans-serif", className: "font-bible-sans" },
  { id: "serif", label: "Serif", className: "font-bible-serif" },
  { id: "dyslexic", label: "Dyslexia-friendly", className: "font-bible-dyslexic" },
  { id: "classic", label: "Classic", className: "font-bible-classic" },
];

const LAYOUTS = [
  { id: "text", label: "Text", icon: AlignLeft },
  { id: "commentary", label: "Commentary", icon: BookOpen },
  { id: "split-top", label: "Both", icon: Rows },
  { id: "split-side", label: "Side by side", icon: Columns2 },
];

const HIGHLIGHT_COLORS = [
  { id: "yellow", swatch: "#F5D547" },
  { id: "green", swatch: "#8FC79A" },
  { id: "blue", swatch: "#8FB8DE" },
  { id: "pink", swatch: "#E8A6C1" },
  { id: "purple", swatch: "#B39DDB" },
  { id: "orange", swatch: "#F0A868" },
  { id: "teal", swatch: "#7EC8C0" },
];
const HIGHLIGHT_BG = {
  yellow: "rgba(245, 213, 71, 0.45)",
  green: "rgba(143, 199, 154, 0.45)",
  blue: "rgba(143, 184, 222, 0.45)",
  pink: "rgba(232, 166, 193, 0.45)",
  purple: "rgba(179, 157, 219, 0.45)",
  orange: "rgba(240, 168, 104, 0.45)",
  teal: "rgba(126, 200, 192, 0.45)",
};

function getPref(key, fallback) {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) || fallback;
}
function setPref(key, value) {
  if (typeof window !== "undefined") localStorage.setItem(key, value);
}

function VerseText({ verses, headings, superscriptions, footnotes, highlights, notes, tags, selection, selectedRange, studyMode, wordTapMode, speakingToken, fontClass, onWordTap, onSpeakWord, onVerseNumberTap, onSelectTap, hintStrongsOnNumber }) {
  const [openFootnotes, setOpenFootnotes] = useState(() => new Set());
  const toggleFootnote = (verseNum) => {
    setOpenFootnotes((prev) => {
      const next = new Set(prev);
      if (next.has(verseNum)) next.delete(verseNum);
      else next.add(verseNum);
      return next;
    });
  };

  return (
    <div className={`space-y-1 ${fontClass || ""}`}>
      {Object.entries(verses)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([num, tokens]) => {
          const verseNum = parseInt(num, 10);
          const verseHighlights = highlights.filter((h) => h.verse_start <= verseNum && h.verse_end >= verseNum);
          const hasNote = notes.some((n) => n.verse_start <= verseNum && n.verse_end >= verseNum);
          const hasTags = tags?.some((t) => t.verse_start <= verseNum && t.verse_end >= verseNum);
          const firstTag = tags?.find((t) => t.verse_start <= verseNum && t.verse_end >= verseNum);
          const isSelecting = selection && verseNum >= selection.rangeStart && verseNum <= selection.rangeEnd;
          const isInActiveRange = selectedRange && verseNum >= selectedRange.start && verseNum <= selectedRange.end;
          // Psalm titles ("A Psalm of David.") are a leading run of tokens
          // flagged "ti" in KJV/BSB. They're drawn on their own line above
          // the verse rather than after the verse number -- but still by
          // renderToken with their REAL indices, so highlights and word
          // study on title words work exactly as before.
          let titleCount = 0;
          while (titleCount < tokens.length && (tokens[titleCount].ti || (!tokens[titleCount].t && tokens[titleCount + 1]?.ti))) titleCount++;
          const renderToken = (tok, i) => {
                // A token that was only source markup (e.g. a lone "[[" in
                // KJV Psalms) is kept as an empty placeholder so highlight
                // positions never shift -- it just renders nothing.
                if (!tok.t) return null;
                const highlight = verseHighlights.find((h) => {
                  const lo = h.verse_start === verseNum ? h.start_pos : 0;
                  const hi = h.verse_end === verseNum ? h.end_pos : Infinity;
                  return i >= lo && i <= hi;
                });
                const isPicked = isSelecting && selection.anchor?.verse === verseNum && selection.anchor?.wordIndex === i;
                const isSpeaking = speakingToken?.verse === verseNum && speakingToken?.index === i;
                const style = highlight ? { backgroundColor: HIGHLIGHT_BG[highlight.color] } : undefined;
                const hasStrongs = studyMode && tok.s.length > 0;
                // Words of Christ, when the source data says so (NLT's
                // <span class="red">, BSB's \wj wrapper). KJV/ESV carry
                // no such flag yet, so tok.r is simply absent for them
                // and nothing here changes.
                const redLetterClass = tok.r ? "text-red-700 dark:text-red-400" : "";
                // Psalm superscriptions ("A Psalm of David...") are part of
                // verse 1 in KJV; show them as a title, on their own line.
                const titleClass = "";
                let next = null;
                for (let j = i + 1; j < tokens.length; j++) {
                  if (tokens[j].t) {
                    next = tokens[j];
                    break;
                  }
                }
                const endsTitle = false;
                // No space before a token that's only closing punctuation
                // (KJV splits some commas into their own token).
                const spaceAfter = next && /^[,.;:!?)\]\u2019\u201d]+$/.test(next.t) ? "" : " ";

                const handleClick = () => {
                  if (wordTapMode) onSpeakWord(tok.t, verseNum, i);
                  else if (isSelecting) onSelectTap(verseNum, i);
                  else if (hasStrongs) onWordTap(tok.s[0], tok.t);
                };

                const clickable = wordTapMode || isSelecting || hasStrongs;

                return (
                  <span
                    key={i}
                    style={style}
                    className={`${redLetterClass} ${titleClass} ${
                      isPicked
                        ? "ring-2 ring-accent rounded"
                        : isSpeaking
                        ? "bg-accent/25 rounded"
                        : ""
                    }`}
                  >
                    {clickable ? (
                      <button
                        onClick={handleClick}
                        className={
                          !isSelecting && !wordTapMode && hasStrongs
                            ? "border-b-2 border-dotted border-accent/60 hover:bg-accent/8"
                            : "hover:bg-accent/8"
                        }
                      >
                        {tok.t}
                      </button>
                    ) : (
                      tok.t
                    )}
                    {endsTitle ? <br /> : spaceAfter}
                  </span>
                );
              };
          const heading = headings[num];
          const verseFootnotes = footnotes?.[num] || [];

          return (
            <div key={num}>
              {heading && (
                <p className="font-serif text-lg text-accent font-semibold mt-7 mb-2.5 first:mt-0">{heading}</p>
              )}
              {superscriptions?.[num] && (
                <p className="font-serif italic text-sm text-inkfaint leading-snug mb-2.5">{superscriptions[num]}</p>
              )}
              {titleCount > 0 && (
                <p className="font-serif italic text-sm text-inkfaint leading-snug mb-2.5">
                  {tokens.slice(0, titleCount).map((tok, i) => renderToken(tok, i))}
                </p>
              )}
              <p
                id={`verse-${verseNum}`}
                className={`text-[0.9375rem] md:text-base leading-relaxed text-ink scroll-mt-24 rounded ${
                  isInActiveRange ? "bg-accent/10 dark:bg-accent/25" : ""
                }`}
              >
              <button
                onClick={() => onVerseNumberTap(verseNum)}
                title={hintStrongsOnNumber ? "Tap for word meanings, cross-references, and more" : undefined}
                className={`text-xs align-super text-accent font-semibold mr-1 ${
                  hintStrongsOnNumber ? "border-b-2 border-dotted border-accent/60" : ""
                }`}
              >
                {num}
              </button>
              {hasNote && (
                <StickyNote size={11} className="inline text-accent mr-1 -translate-y-0.5" strokeWidth={2.2} />
              )}
              {hasTags && (
                <Tag
                  size={11}
                  className={`inline mr-1 -translate-y-0.5 ${tagColorClass(firstTag.tag, "icon")}`}
                  strokeWidth={2.2}
                />
              )}
              {tokens.map((tok, i) => (i < titleCount ? null : renderToken(tok, i)))}
              {verseFootnotes.length > 0 && (
                <button
                  onClick={() => toggleFootnote(verseNum)}
                  className="text-[0.625rem] align-super text-accent/70 hover:text-accent ml-0.5"
                  aria-label="Footnote"
                >
                  [{openFootnotes.has(verseNum) ? "−" : "+"}]
                </button>
              )}
              </p>
              {verseFootnotes.length > 0 && openFootnotes.has(verseNum) && (
                <div className="mt-1 mb-2 pl-3 border-l-2 border-line space-y-1">
                  {verseFootnotes.map((note, i) => (
                    <p key={i} className="text-xs text-inkfaint italic leading-relaxed">
                      {note}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

function CommentaryNotes({ notes }) {
  if (notes.length === 0) {
    return <p className="text-sm text-inkfaint">No commentary notes for this chapter.</p>;
  }
  return (
    <div className="space-y-3">
      {notes.map((n, i) => (
        <div key={i}>
          <p className="text-xs font-semibold text-accent mb-1">
            {n.ref
              ? `Section ${n.ref}`
              : n.v1 === n.v2
              ? `Verse ${n.v1}`
              : `Verses ${n.v1}-${n.v2}`}
          </p>
          <p className="text-sm md:text-[0.9375rem] text-inksoft leading-relaxed">{n.text}</p>
        </div>
      ))}
    </div>
  );
}

// A pane with its own independent scrollbar -- used so, in split views, you
// can scroll through a long commentary without losing your place in the
// verse text (or vice versa), instead of everything scrolling as one.
function ScrollPane({ label, children, className = "" }) {
  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <p className="text-[0.625rem] uppercase tracking-wide text-inkfaint mb-1.5 flex-shrink-0">{label}</p>
      <div className="overflow-y-auto flex-1 min-h-0 pr-1">{children}</div>
    </div>
  );
}

const DICT_LABELS = {
  easton: "Easton's",
  smith: "Smith's",
  hitchcock: "Hitchcock's",
  torrey: "Torrey's",
  webster: "Webster's",
  tyndale: "Tyndale",
  "tyndale-themes": "Tyndale Themes",
};

function WordStudyContent({ entry, id, dictMatches }) {
  const [expanded, setExpanded] = useState(null);
  const matchKeys = dictMatches ? Object.keys(dictMatches) : [];

  return (
    <div>
      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-line">
        <span className="flex-shrink-0 bg-accent text-white text-sm font-bold rounded-lg px-2.5 py-1.5">
          {id}
        </span>
        <div className="min-w-0">
          <p className="font-serif text-xl text-ink leading-tight">{entry.Hb_word || entry.Gk_word}</p>
          <p className="text-sm text-inkfaint italic">{entry.transliteration}</p>
        </div>
      </div>
      <div className="space-y-3.5">
        {entry.part_of_speech && (
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-0.5">Part of speech</p>
            <p className="text-sm text-ink">{entry.part_of_speech}</p>
          </div>
        )}
        <div>
          <p className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-0.5">Definition</p>
          <p className="text-sm text-ink leading-relaxed">{entry.strongs_def}</p>
        </div>
        {entry.outline_usage && (
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-0.5">Usage</p>
            <p className="text-sm text-ink leading-relaxed">{entry.outline_usage}</p>
          </div>
        )}
        {entry.root_word && (
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-0.5">Root word</p>
            <p className="text-sm text-ink leading-relaxed">{entry.root_word}</p>
          </div>
        )}
        {entry.derivation && (
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-0.5">Derivation</p>
            <p className="text-sm text-ink leading-relaxed">
              {entry.derivation}
              {entry.is_root && <span className="text-accent font-medium"> (a root word)</span>}
            </p>
          </div>
        )}
        {entry.twot && (
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-0.5">TWOT / TDNT Reference</p>
            <p className="text-sm text-ink leading-relaxed">{entry.twot}</p>
          </div>
        )}
        {entry.occurrences && (
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-0.5">Translated as</p>
            <p className="text-sm text-ink leading-relaxed">{cleanOccurrences(entry.occurrences)}</p>
          </div>
        )}
      </div>

      {matchKeys.length > 0 && (
        <div className="mt-4 pt-4 border-t border-line">
          <p className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-2">Also look up</p>
          <div className="flex flex-wrap gap-2">
            {matchKeys.map((key) => (
              <button
                key={key}
                onClick={() => setExpanded(expanded === key ? null : key)}
                className={`text-xs rounded-full px-3 py-1.5 ${
                  expanded === key ? "bg-accent text-white" : "bg-accent/8 text-accent hover:bg-accent/15"
                }`}
              >
                {DICT_LABELS[key]}
              </button>
            ))}
          </div>
          {expanded && dictMatches[expanded] && (
            <div className="mt-3 sp-card">
              {dictMatches[expanded].lines ? (
                <div className="space-y-1">
                  {dictMatches[expanded].lines.map((line, i) => (
                    <p key={i} className="text-sm text-inksoft leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-inksoft leading-relaxed">{dictMatches[expanded].text}</p>
              )}
              {/* REQUIRED, not decorative: the Tyndale Open Bible
                  Dictionary is CC BY-SA 4.0, which conditions reuse on
                  clear attribution wherever the content is shown. The
                  public-domain sources above it (Easton's, Smith's,
                  Hitchcock's, Torrey's, Webster's) carry no such
                  requirement, which is why only this one gets a line. */}
              {expanded === "tyndale" && (
                <p className="text-[0.625rem] text-inkfaint mt-2.5 pt-2 border-t border-line">
                  Tyndale Open Bible Dictionary, © Tyndale House Publishers. Used under{" "}
                  <a
                    href="https://creativecommons.org/licenses/by-sa/4.0/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    CC BY-SA 4.0
                  </a>
                  .
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Shown when someone taps a verse's Strong's button on a translation
// with no word-level alignment of its own (esv/nlt). Lists that verse's
// words AS WORDED IN THE KJV, each one tappable into the exact same
// word-definition popup a KJV word tap opens (onWordTap) -- so this is
// a doorway into existing Strong's data, not a separate feature with
// its own content. Words with no Strong's number (KJV's "the", "and",
// etc.) are shown but not tappable, same as they aren't in KJV itself.
function VerseStrongsContent({ perVerse, translationLabel, onWordTap }) {
  return (
    <div className="space-y-5">
      <p className="text-xs text-inkfaint leading-relaxed pb-3.5 mb-1 border-b border-line">
        {translationLabel} doesn&apos;t align word-for-word with the original Hebrew and Greek, so
        these are the words as the King James renders this verse. Tap one for its meaning.
      </p>
      {perVerse.map(({ verse, words }) => (
        <div key={verse}>
          <p className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-2">
            Verse {verse} &middot; King James wording
          </p>
          <p className="leading-relaxed">
            {words.map((w, i) => (
              <span key={i}>
                {w.strongsId ? (
                  <button
                    onClick={() => onWordTap(w.strongsId, w.text)}
                    className="text-sm text-ink border-b-2 border-dotted border-accent/60 hover:bg-accent/8 rounded px-0.5"
                  >
                    {w.text}
                  </button>
                ) : (
                  <span className="text-sm text-inksoft">{w.text}</span>
                )}{" "}
              </span>
            ))}
          </p>
        </div>
      ))}
    </div>
  );
}

// `showCommentary` is false on ESV/NLT. The cross-reference list itself
// is keyed by book/chapter/verse -- numbering that's the same across
// these translations -- so the references resolve fine whatever you're
// reading. Matthew Henry is the only part that doesn't travel: he
// quotes King James wording directly, so pairing him with modern
// phrasing reads as a mismatch. Refs stay, commentary goes.
function CrossRefRangeContent({ perVerse, onGoTo, showCommentary = true, commentaryLabel = "Commentary", commentaryAttribution = false }) {
  // The underlying commentary data is itself stored as verse ranges (e.g.
  // one entry covering verses 1-3), so fetching per verse can return the
  // exact same entry more than once. Dedupe by its own v1/v2 range rather
  // than by verse, and show it once, together, after all the cross-refs.
  const seen = new Set();
  const allCommentary = [];
  for (const { commentary } of perVerse) {
    if (!commentary) continue;
    for (const c of commentary) {
      // Include the text: two different section notes can share the
      // same local v1/v2 (both "1-999" in a chapter they pass through),
      // and keying on range alone silently dropped the second one.
      const key = `${c.ref || `${c.v1}-${c.v2}`}|${c.text}`;
      if (!seen.has(key)) {
        seen.add(key);
        allCommentary.push(c);
      }
    }
  }

  return (
    <div>
      <div className="space-y-5">
        {perVerse.map(({ verse, refs }) => (
          <div key={verse}>
            <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Verse {verse}</p>
            {refs.length === 0 ? (
              <p className="text-sm text-inkfaint">No cross-references found.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {refs.map((ref) => (
                  <button
                    key={ref}
                    onClick={() => onGoTo(ref)}
                    className="text-xs bg-accent/8 text-accent rounded-full px-3 py-1.5 hover:bg-accent/15"
                  >
                    {formatReference(ref)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {showCommentary && allCommentary.length > 0 && (
        <div className="mt-6 pt-4 border-t border-line">
          <p className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-2">
            {commentaryLabel}
          </p>
          <div className="space-y-3">
            {allCommentary.map((c, i) => (
              <p key={i} className="text-sm text-inksoft leading-relaxed">
                {c.text}
              </p>
            ))}
          </div>
          {commentaryAttribution && (
            <p className="text-[0.625rem] text-inkfaint mt-3">
              Tyndale Open Study Notes, © Tyndale House Publishers. Used under{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                CC BY-SA 4.0
              </a>
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PassageReader({ initialBook = "Gen", initialChapter = 1, initialVerse = null, deviceId }) {
  const run = useAction();
  const [book, setBook] = useState(initialBook);
  const [chapterCounts, setChapterCounts] = useState({});
  const [chapter, setChapter] = useState(initialChapter);
  const [layout, setLayout] = useState("text");
  const [studyMode, setStudyModeState] = useState(true);
  const [bibleFont, setBibleFontState] = useState("sans");
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [desktopMode, setDesktopModeState] = useState(false);
  const [verses, setVerses] = useState(null);
  const [headings, setHeadings] = useState({});
  const [footnotes, setFootnotes] = useState({});
  // "tyndale" (default -- verse-range keyed, reads naturally against any
  // translation) or "matthew-henry" (keyed to KJV wording specifically,
  // but available everywhere now by deliberate choice).
  const [commentarySource, setCommentarySourceState] = useState("tyndale");
  const [translation, setTranslationState] = useState(DEFAULT_TRANSLATION);
  const [translationPickerOpen, setTranslationPickerOpen] = useState(false);
  // Null on KJV. On ESV/NLT this is the publisher's required copyright
  // notice, which must be rendered wherever their text is shown.
  const [copyright, setCopyright] = useState(null);
  const [attributionUrl, setAttributionUrl] = useState(null);
  // Set when a chosen translation failed and we fell back to KJV, so
  // the reader can say so instead of silently showing different words.
  const [translationFallback, setTranslationFallback] = useState(null);
  // Compare mode shows the chosen translation alongside the KJV. Only
  // meaningful when the chosen translation ISN'T the KJV, and it costs
  // no extra API call -- the KJV pane is served from local data.
  const [compareWithKjv, setCompareWithKjv] = useState(false);
  const [kjvVerses, setKjvVerses] = useState(null);
  const [commentaryNotes, setCommentaryNotes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [popup, setPopup] = useState(null); // { type: 'word'|'verse'|'loading'|'error', ...data }

  const [highlights, setHighlights] = useState([]);
  const [myNotes, setMyNotes] = useState([]);
  const [tags, setTags] = useState([]);
  const [verseMenu, setVerseMenu] = useState(null); // { start, end } | null -- a range of one or more verses
  const [selection, setSelection] = useState(null); // { verse, startPos }
  const [colorPickerFor, setColorPickerFor] = useState(null); // { verse, start_pos, end_pos }
  const [noteEditor, setNoteEditor] = useState(null); // { verse, existing }
  const [tagEditor, setTagEditor] = useState(null); // { start, end } | null
  const [tagInput, setTagInput] = useState("");
  const [ttsOpen, setTtsOpen] = useState(false);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const [bookChapterPickerOpen, setBookChapterPickerOpen] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(null);
  const [wordTapMode, setWordTapMode] = useState(false);
  const [chapterPlaying, setChapterPlaying] = useState(false);
  const [chapterPaused, setChapterPaused] = useState(false);
  const [speakingToken, setSpeakingToken] = useState(null); // { verse, index } | null
  const utteranceRef = useRef(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpTab, setJumpTab] = useState("goto"); // "goto" | "find"
  const [jumpInput, setJumpInput] = useState("");
  const [jumpError, setJumpError] = useState("");
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const [pendingScroll, setPendingScroll] = useState(initialVerse && initialVerse > 1 ? initialVerse : null);
  // Study-mode extras (Tyndale book intro on chapter 1, theme notes that
  // start in this chapter). Passage-level, not wording-level, so they
  // appear the same on every translation.
  const [chapterExtras, setChapterExtras] = useState(null);
  // A full book introduction shown IN the reading area (in place of the
  // chapter text) rather than squeezed into a popup. Cleared whenever
  // the reader moves to another chapter.
  const [introView, setIntroView] = useState(null);
  const [copiedVerse, setCopiedVerse] = useState(null);

  // ── Derived translation flags ───────────────────────────────────────
  // These MUST stay above every useEffect below: several of them read
  // wordStudyAvailable/commentaryAvailable in their dependency arrays, evaluated
  // during render. `const` isn't hoisted, so declaring these further
  // down throws "Cannot access before initialization" and takes the
  // whole reader down with it.
  //
  // Two DIFFERENT gates, easy to conflate:
  //
  // wordStudyAvailable -- does the text ON SCREEN carry a Strong's
  // number per word? True for kjv and bsb (both stored locally as
  // {t, s} tokens). False for esv/nlt, which arrive as plain text with
  // no word-level alignment -- they get verse-level Strong's instead
  // (borrowed from KJV; see showVerseStrongs below), NOT word taps.
  //
  // commentaryAvailable -- is the text on screen actually KJV's OWN
  // wording? Narrower than wordStudyAvailable: BSB has Strong's too,
  // but Matthew Henry quotes KJV phrasing directly and the
  // cross-reference set indexes KJV verse wording, so both would still
  // be a mismatch against BSB's (different) wording. True only for kjv.
  //
  // Both fall back to true when a translationFallback is in effect,
  // because the verses actually rendered at that point are real KJV
  // verses regardless of what `translation` still says was picked.
  const activeTranslation = getTranslation(translation) || getTranslation(DEFAULT_TRANSLATION);
  const wordStudyAvailable = translationFallback ? true : !!activeTranslation.supportsStrongs;
  const commentaryAvailable = translationFallback ? true : !!activeTranslation.supportsCommentary;
  const comparing = compareWithKjv && translation !== "kjv" && !translationFallback && !!kjvVerses;
  // Commentary layouts (Matthew Henry, the split views) only make sense
  // against KJV's own wording -- see commentaryAvailable above.
  const effectiveLayout = commentaryAvailable ? layout : "text";
  const commentaryLabel = commentarySource === "tyndale" ? "Tyndale Study Notes" : "Matthew Henry's Commentary";
  const commentaryAttributionLine = commentarySource === "tyndale" && (
    <p className="text-[0.625rem] text-inkfaint mt-3">
      Tyndale Open Study Notes, © Tyndale House Publishers. Used under{" "}
      <a
        href="https://creativecommons.org/licenses/by-sa/4.0/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        CC BY-SA 4.0
      </a>
      .
    </p>
  );

  useEffect(() => {
    setLayout(getPref("sp_bible_layout", "text"));
    setStudyModeState(getPref("sp_bible_study_mode", getSimpleMode() ? "simple" : "study") !== "simple");
    setBibleFontState(getPref("sp_bible_font", "sans"));
    const savedTranslation = getPref("sp_bible_translation", DEFAULT_TRANSLATION);
    if (getTranslation(savedTranslation)) setTranslationState(savedTranslation);
    setCompareWithKjv(getPref("sp_bible_compare_kjv", "off") === "on");
    setCommentarySourceState(getPref("sp_bible_commentary_source", "tyndale"));
    setDesktopModeState(getDesktopMode());
    api.getChapterCounts().then((d) => setChapterCounts(d.counts || {}));
    const onChange = () => setDesktopModeState(getDesktopMode());
    window.addEventListener("sp-desktop-mode-change", onChange);
    return () => window.removeEventListener("sp-desktop-mode-change", onChange);
  }, []);

  // Voice list loads asynchronously in some browsers (notably Chrome), so we
  // listen for the change event rather than assuming getVoices() is ready.
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      setVoices(list);
      const saved = getPref("sp_bible_tts_voice", "");
      if (saved && list.some((v) => v.voiceURI === saved)) {
        setSelectedVoiceURI(saved);
      } else if (list.length > 0 && !selectedVoiceURI) {
        setSelectedVoiceURI(list[0].voiceURI);
      }
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseVoice = (uri) => {
    setSelectedVoiceURI(uri);
    setPref("sp_bible_tts_voice", uri);
  };

  const getSelectedVoice = () => voices.find((v) => v.voiceURI === selectedVoiceURI) || null;

  useEffect(() => {
    setBook(initialBook);
    setChapter(initialChapter);
  }, [initialBook, initialChapter]);

  useEffect(() => {
    setFindQuery("");
    setFindIndex(0);
  }, [book, chapter]);

  // Remember the last-read position so re-opening the Bible tab returns here,
  // instead of always starting over at Genesis 1. Also logs to the
  // recently-viewed list shown in the picker.
  useEffect(() => {
    setPref("sp_bible_last_book", book);
    setPref("sp_bible_last_chapter", String(chapter));
    addRecentPassage(book, chapter);
  }, [book, chapter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setVerses(null);
    setKjvVerses(null);
    setCopyright(null);
    setFootnotes({});
    setAttributionUrl(null);
    setTranslationFallback(null);

    const wantsKjvPane = compareWithKjv && translation !== "kjv";

    try {
      // The KJV pane is local, so fetching it alongside costs nothing
      // external -- compare mode is no more expensive than reading the
      // modern translation on its own.
      const [primary, kjv] = await Promise.all([
        api.getPassage(book, chapter, translation),
        wantsKjvPane ? api.getPassage(book, chapter, "kjv") : Promise.resolve(null),
      ]);

      setVerses(primary.verses);
      setHeadings(primary.headings || {});
      setFootnotes(primary.footnotes || {});
      setCopyright(primary.copyright || null);
      setAttributionUrl(primary.attributionUrl || null);
      if (kjv) setKjvVerses(kjv.verses);
    } catch (err) {
      // A licensed translation can fail for reasons the KJV never will
      // -- missing key, publisher outage, daily quota. Falling back to
      // the KJV keeps the person reading; the banner tells them the
      // words on screen aren't the translation they picked.
      if (translation !== "kjv") {
        try {
          const kjv = await api.getPassage(book, chapter, "kjv");
          setVerses(kjv.verses);
          setHeadings(kjv.headings || {});
          setFootnotes(kjv.footnotes || {});
          setTranslationFallback({
            attempted: getTranslation(translation)?.label || translation,
            reason: err.message || "",
          });
        } catch {
          setError("Couldn't load that passage.");
        }
      } else {
        setError(err.message || "Couldn't load that passage.");
      }
    } finally {
      setLoading(false);
    }
  }, [book, chapter, translation, compareWithKjv]);

  useEffect(() => {
    load();
  }, [load]);

  // Once a chapter finishes loading, scroll to a specific verse if one was
  // requested (via jump-to-reference or a cross-reference link).
  useEffect(() => {
    if (!verses || pendingScroll == null) return;
    const el = document.getElementById(`verse-${pendingScroll}`);
    if (el) el.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    setPendingScroll(null);
  }, [verses, pendingScroll]);

  // While a chapter is being read aloud, keep the currently-spoken verse in view.
  useEffect(() => {
    if (!speakingToken) return;
    const el = document.getElementById(`verse-${speakingToken.verse}`);
    if (el) el.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
  }, [speakingToken?.verse]);

  useEffect(() => {
    if (!commentaryAvailable) return;
    if (layout === "commentary" || layout === "split-top" || layout === "split-side") {
      api.getCommentary(book, chapter, commentarySource).then((d) => setCommentaryNotes(d.notes));
    }
  }, [book, chapter, layout, commentaryAvailable, commentarySource]);

  // The translation whose words are ACTUALLY on screen. When a licensed
  // translation fails and we fall back to KJV text, highlights must load
  // and save as KJV -- otherwise KJV word positions get stored as NLT/ESV
  // and land on the wrong words later.
  const highlightTranslation = translationFallback ? "kjv" : translation;

  // Every highlight request gets a sequence number; only the newest one
  // is allowed to write state. Without this, switching translations
  // quickly let an older, slower response land last and paint the
  // previous translation's word positions onto the new text.
  const highlightReqSeq = useRef(0);

  const loadMyData = useCallback(() => {
    if (!deviceId) return;
    // Highlights are translation-scoped (word positions don't transfer);
    // notes and tags attach to verse ranges, so they follow you across
    // translations on purpose.
    const seq = ++highlightReqSeq.current;
    api
      .getHighlights(deviceId, book, chapter, highlightTranslation)
      .then((d) => {
        if (seq === highlightReqSeq.current) setHighlights(d.highlights || []);
      })
      .catch(() => {
        if (seq === highlightReqSeq.current) setHighlights([]);
      });
    api.getNotes(deviceId, book, chapter).then((d) => setMyNotes(d.notes || []));
    api.getTags(deviceId, book, chapter).then((d) => setTags(d.tags || []));
  }, [deviceId, book, chapter, highlightTranslation]);

  // Drop the previous chapter/translation's highlights immediately, so
  // they never render against different words while the new set loads.
  useEffect(() => {
    setHighlights([]);
  }, [book, chapter, highlightTranslation]);

  useEffect(() => {
    loadMyData();
  }, [loadMyData]);

  useEffect(() => {
    setChapterExtras(null);
    if (!studyMode) return;
    let live = true;
    api
      .getChapterExtras(book, chapter)
      .then((d) => live && setChapterExtras(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [book, chapter, studyMode]);

  const openLibraryItem = async (collection, id) => {
    if (collection === "intros") {
      try {
        const d = await api.getLibraryItem(collection, id);
        setIntroView(d.item);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: scrollBehavior() });
      } catch {
        setPopup({ type: "error", message: "Couldn't load the introduction. Try again in a moment." });
      }
      return;
    }
    // Theme notes (and anything else) open in the Study Panel on desktop,
    // or the bottom sheet on a phone -- same place as cross-references.
    setPopup({ type: "loading" });
    try {
      const d = await api.getLibraryItem(collection, id);
      setPopup({ type: "library", collection, item: d.item });
    } catch {
      setPopup({ type: "error", message: "Couldn't load that. Try again in a moment." });
    }
  };

  useEffect(() => {
    setIntroView(null);
  }, [book, chapter]);

  const chooseLayout = (id) => {
    setLayout(id);
    setPref("sp_bible_layout", id);
  };

  const toggleStudyMode = () => {
    const next = !studyMode;
    setStudyModeState(next);
    setPref("sp_bible_study_mode", next ? "study" : "simple");
  };

  const chooseBibleFont = (id) => {
    setBibleFontState(id);
    setPref("sp_bible_font", id);
    setFontPickerOpen(false);
  };

  const onWordTap = async (strongsId, rawWord) => {
    setPopup({ type: "loading" });
    const cleanWord = (rawWord || "").replace(/[.,;:!?"'()]/g, "").trim();
    try {
      const [lexRes, lookupRes] = await Promise.all([
        api.getLexiconEntry(strongsId),
        cleanWord ? api.wordLookup(cleanWord) : Promise.resolve({ matches: {} }),
      ]);
      setPopup({ type: "word", id: strongsId, entry: lexRes.entry, dictMatches: lookupRes.matches });
    } catch {
      setPopup({ type: "error", message: "Couldn't load that word's definition." });
    }
  };

  // ESV/NLT don't align word-for-word with the underlying Hebrew/Greek,
  // so per-word tapping isn't available on them (see wordStudyAvailable).
  // This is the honest substitute: pull the KJV wording of the SAME
  // verse -- which does carry Strong's numbers -- and let the person
  // browse those. It's explicitly labeled as KJV-derived rather than
  // pretending to describe the translation on screen, because the KJV
  // may render the verse with different words, in a different order,
  // or as a different number of words entirely.
  const showVerseStrongs = async (range) => {
    setPopup({ type: "loading" });
    try {
      const kjv = await api.getPassage(book, chapter, "kjv");
      const perVerse = [];
      for (let v = range.start; v <= range.end; v++) {
        const tokens = kjv.verses[String(v)] || [];
        // Collapse consecutive tokens that share the same Strong's
        // number into one entry -- the KJV data tags each English word
        // separately even when several words translate one Hebrew or
        // Greek word (e.g. "in the beginning" all under H7225), and
        // listing that as three identical entries would be confusing.
        const words = [];
        for (const tok of tokens) {
          const strongsId = tok.s?.[0] || null;
          const prev = words[words.length - 1];
          if (strongsId && prev && prev.strongsId === strongsId) {
            prev.text += " " + tok.t;
          } else {
            words.push({ text: tok.t, strongsId });
          }
        }
        perVerse.push({ verse: v, words });
      }
      setPopup({ type: "verse-strongs", start: range.start, end: range.end, perVerse });
    } catch {
      setPopup({ type: "error", message: "Couldn't load the King James wording for that verse." });
    }
  };

  const showCrossRefs = async (range) => {
    setPopup({ type: "loading" });
    try {
      const verseNums = [];
      for (let v = range.start; v <= range.end; v++) verseNums.push(v);
      const perVerse = await Promise.all(
        verseNums.map((v) =>
          api
            .getCrossRefs(book, chapter, v, commentarySource)
            .then((d) => ({ verse: v, refs: d.refs || [], commentary: d.commentary || [] }))
        )
      );
      setPopup({ type: "verse-range", start: range.start, end: range.end, perVerse });
    } catch {
      setPopup({ type: "error", message: "Couldn't load cross-references." });
    }
  };

  // Previous / Next chapter, crossing book boundaries (v71 #6/#27). null
  // means "nowhere to go" and the matching button is disabled.
  const prevTarget = adjacentChapter(book, chapter, -1, chapterCounts);
  const nextTarget = adjacentChapter(book, chapter, 1, chapterCounts);

  const changeChapter = (delta) => {
    const target = delta < 0 ? prevTarget : nextTarget;
    if (!target) return;
    setIntroView(null);
    if (target.book !== book) setBook(target.book);
    setChapter(target.chapter);
  };

  const goToReference = (ref) => {
    const m = ref.match(/^(\w+)\s+(\d+):(\d+)/);
    if (!m) return;
    setIntroView(null);
    const [, bookAbbr, chap, verse] = m;
    setBook(bookAbbr);
    setChapter(parseInt(chap, 10));
    setPendingScroll(parseInt(verse, 10));
    setPopup(null);
  };

  const jumpToReference = () => {
    const parsed = parseQuickReference(jumpInput);
    if (!parsed) {
      setJumpError("Couldn't find that reference. Try something like \"John 3:16\".");
      return;
    }
    setBook(parsed.bookAbbr);
    setChapter(parsed.chapter);
    if (parsed.verse) setPendingScroll(parsed.verse);
    setJumpOpen(false);
    setJumpInput("");
    setJumpError("");
  };

  const copyVerseRange = async (range) => {
    if (!verses) return;
    const parts = [];
    for (let v = range.start; v <= range.end; v++) {
      const tokens = verses[v];
      if (tokens) parts.push(tokensToText(tokens));
    }
    if (parts.length === 0) return;
    const text = parts.join(" ");
    const reference =
      range.start === range.end
        ? `${ABBR_TO_NAME[book]} ${chapter}:${range.start}`
        : `${ABBR_TO_NAME[book]} ${chapter}:${range.start}-${range.end}`;
    try {
      await navigator.clipboard.writeText(`"${text}" — ${reference}`);
      setCopiedVerse(`${range.start}-${range.end}`);
      setTimeout(() => setCopiedVerse(null), 1500);
    } catch {
      // Clipboard access can fail (e.g. permissions); fail quietly, nothing to recover.
    }
  };

  const findMatches = (() => {
    if (!verses || !findQuery.trim()) return [];
    const q = findQuery.trim().toLowerCase();
    return Object.entries(verses)
      .filter(([, tokens]) => tokensToText(tokens).toLowerCase().includes(q))
      .map(([num]) => parseInt(num, 10))
      .sort((a, b) => a - b);
  })();

  const goToFindMatch = (index) => {
    if (findMatches.length === 0) return;
    const wrapped = ((index % findMatches.length) + findMatches.length) % findMatches.length;
    setFindIndex(wrapped);
    setPendingScroll(findMatches[wrapped]);
  };

  const onVerseNumberTap = (verseNum) => {
    // Opening a brand new selection should always start clean -- clear out
    // anything left over from a previous action (cross-refs, highlighting,
    // a note, a tag). Without this, a stale popup from an earlier verse can
    // silently block the new selection from appearing.
    setPopup(null);
    setSelection(null);
    setColorPickerFor(null);
    setNoteEditor(null);
    setTagEditor(null);

    if (!verseMenu) {
      setVerseMenu({ start: verseNum, end: verseNum });
      return;
    }
    const { start, end } = verseMenu;
    // Tapping the sole selected verse again closes the menu, same as before.
    if (start === end && verseNum === start) {
      setVerseMenu(null);
      return;
    }
    // Tapping either edge of the current range again shrinks it -- this is
    // how you remove a verse you've already added.
    if (verseNum === start) {
      setVerseMenu({ start: start + 1, end });
      return;
    }
    if (verseNum === end) {
      setVerseMenu({ start, end: end - 1 });
      return;
    }
    // Tapping just past either edge extends the range to include it.
    if (verseNum === start - 1) {
      setVerseMenu({ start: verseNum, end });
      return;
    }
    if (verseNum === end + 1) {
      setVerseMenu({ start, end: verseNum });
      return;
    }
    // Anything else (inside the middle, or somewhere unrelated) starts a
    // fresh single-verse selection rather than guessing what was meant.
    setVerseMenu({ start: verseNum, end: verseNum });
  };

  const startHighlighting = (range) => {
    // Tap a word anywhere within the selected verses to set one end of the
    // highlight, then tap another word to set the other end -- works the
    // same whether that's one verse or several.
    setSelection({ rangeStart: range.start, rangeEnd: range.end, anchor: null });
  };

  const cancelHighlighting = () => setSelection(null);

  const onSelectTap = (verseNum, wordIndex) => {
    // Ignore taps outside the verses that were actually selected.
    if (verseNum < selection.rangeStart || verseNum > selection.rangeEnd) return;

    if (!selection.anchor) {
      setSelection({ ...selection, anchor: { verse: verseNum, wordIndex } });
      return;
    }
    const a = selection.anchor;
    const b = { verse: verseNum, wordIndex };
    const [first, second] =
      a.verse < b.verse || (a.verse === b.verse && a.wordIndex <= b.wordIndex) ? [a, b] : [b, a];
    setColorPickerFor({
      verseStart: first.verse,
      verseEnd: second.verse,
      start_pos: first.wordIndex,
      end_pos: second.wordIndex,
    });
    setSelection(null);
  };

  const saveHighlight = async (color) => {
    if (!colorPickerFor || !deviceId) return;
    // v71 #8: a failed highlight now says so (it used to fail silently and
    // the highlight simply never appeared). The picker closes either way.
    const { ok } = await run(() =>
      api.addHighlight({
        device_id: deviceId,
        book,
        chapter,
        translation: highlightTranslation,
        verse_start: colorPickerFor.verseStart,
        verse_end: colorPickerFor.verseEnd,
        start_pos: colorPickerFor.start_pos,
        end_pos: colorPickerFor.end_pos,
        color,
      })
    );
    setColorPickerFor(null);
    if (ok) loadMyData();
  };

  const clearRangeHighlights = async (range) => {
    // Removes any highlight that overlaps the selected range at all, not
    // just ones matching it exactly -- "clear what I've selected" is the
    // more intuitive reading than requiring an exact range match.
    const toRemove = highlights.filter((h) => h.verse_start <= range.end && h.verse_end >= range.start);
    // Refreshes either way so the screen shows what's actually left.
    await run(() => Promise.all(toRemove.map((h) => api.removeHighlight(h.id, deviceId))));
    loadMyData();
  };

  const openNoteEditor = (range) => {
    const existing = myNotes.find((n) => n.verse_start === range.start && n.verse_end === range.end);
    setNoteEditor({ verseStart: range.start, verseEnd: range.end, existing: existing || null });
  };

  const saveNote = async (text) => {
    if (!noteEditor || !deviceId) return;
    // The note editor stays open, with the text in it, if this fails.
    const { ok } = await run(
      () =>
        api.saveNote({
          device_id: deviceId,
          book,
          chapter,
          verse_start: noteEditor.verseStart,
          verse_end: noteEditor.verseEnd,
          text,
        }),
      { success: "Note saved" }
    );
    if (ok) {
      setNoteEditor(null);
      loadMyData();
    }
  };

  const deleteNote = async () => {
    if (!noteEditor?.existing || !deviceId) return;
    const { ok } = await run(() => api.removeNote(noteEditor.existing.id, deviceId), { success: "Note deleted" });
    if (ok) {
      setNoteEditor(null);
      loadMyData();
    }
  };

  const addTag = async () => {
    const tag = tagInput.trim();
    if (!tag || !deviceId || !tagEditor) return;
    const { ok } = await run(() =>
      api.addTag({
        device_id: deviceId,
        book,
        chapter,
        verse_start: tagEditor.start,
        verse_end: tagEditor.end,
        tag,
      })
    );
    if (ok) {
      setTagInput(""); // the tag stays typed if it didn't save
      loadMyData();
    }
  };

  const removeTag = async (id) => {
    if (!deviceId) return;
    await run(() => api.removeTag(id, deviceId));
    loadMyData();
  };

  const buildSpokenChapterData = () => {
    if (!verses) return null;
    const verseNums = Object.keys(verses).map(Number).sort((a, b) => a - b);
    const flatTokens = [];
    let text = "";
    for (const vNum of verseNums) {
      verses[vNum].forEach((tok, i) => {
        if (!tok.t) return; // empty placeholder (see VerseText)
        flatTokens.push({ verse: vNum, index: i, offset: text.length });
        text += tok.t + " ";
      });
    }
    return { text, flatTokens };
  };

  const findTokenAtOffset = (flatTokens, charIndex) => {
    let match = null;
    for (const tok of flatTokens) {
      if (tok.offset <= charIndex) match = tok;
      else break;
    }
    return match;
  };

  const playChapter = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const built = buildSpokenChapterData();
    if (!built) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(built.text);
    utterance.rate = 0.95;
    const voice = getSelectedVoice();
    if (voice) utterance.voice = voice;
    utterance.onboundary = (event) => {
      if (event.name && event.name !== "word") return;
      const tok = findTokenAtOffset(built.flatTokens, event.charIndex);
      if (tok) setSpeakingToken({ verse: tok.verse, index: tok.index });
    };
    utterance.onend = () => {
      setChapterPlaying(false);
      setChapterPaused(false);
      setSpeakingToken(null);
    };
    utterance.onerror = () => {
      setChapterPlaying(false);
      setChapterPaused(false);
      setSpeakingToken(null);
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setChapterPlaying(true);
    setChapterPaused(false);
  };

  const pauseChapter = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.pause();
    setChapterPaused(true);
  };

  const resumeChapter = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.resume();
    setChapterPaused(false);
  };

  const stopChapter = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setChapterPlaying(false);
    setChapterPaused(false);
    setSpeakingToken(null);
  };

  const speakWord = (text, verseNum, index) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = (text || "").replace(/[.,;:!?"'()]/g, "");
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 0.85;
    const voice = getSelectedVoice();
    if (voice) utterance.voice = voice;
    if (verseNum != null && index != null) {
      setSpeakingToken({ verse: verseNum, index });
      utterance.onend = () => setSpeakingToken(null);
      utterance.onerror = () => setSpeakingToken(null);
    }
    window.speechSynthesis.speak(utterance);
  };

  // Stop any speech in progress when leaving the chapter or the reader.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [book, chapter]);

  // Used by the verse action bar to decide button labels/visibility for the
  // currently selected range.
  const rangeHasHighlights = (range) =>
    highlights.some((h) => h.verse_start <= range.end && h.verse_end >= range.start);
  const rangeNote = (range) => myNotes.find((n) => n.verse_start === range.start && n.verse_end === range.end);
  const rangeTags = (range) => tags.filter((t) => t.verse_start === range.start && t.verse_end === range.end);

  const chooseTranslation = (id) => {
    setTranslationState(id);
    setPref("sp_bible_translation", id);
    setTranslationPickerOpen(false);
  };

  const chooseCommentarySource = (source) => {
    setCommentarySourceState(source);
    setPref("sp_bible_commentary_source", source);
  };

  const toggleCompare = () => {
    const next = !compareWithKjv;
    setCompareWithKjv(next);
    setPref("sp_bible_compare_kjv", next ? "on" : "off");
  };

  // v71 #27: the toolbar is its own component (BibleToolbar.jsx). Every tool
  // stays on it -- none goes into a "More" menu -- and it says what's active.
  const layoutNow = LAYOUTS.find((l) => l.id === layout);
  const controls = (
    <BibleToolbar
      bookName={ABBR_TO_NAME[book]}
      chapter={chapter}
      canGoPrev={Boolean(prevTarget)}
      canGoNext={Boolean(nextTarget)}
      onPrev={() => changeChapter(-1)}
      onNext={() => changeChapter(1)}
      onOpenBookPicker={() => setBookChapterPickerOpen(true)}
      chapterPlaying={chapterPlaying}
      onListen={() => setTtsOpen(true)}
      wordTapMode={wordTapMode}
      onToggleWordTap={() => setWordTapMode(!wordTapMode)}
      onFind={() => setJumpOpen(true)}
      onFont={() => setFontPickerOpen(true)}
      translationLabel={activeTranslation.label}
      onTranslation={() => setTranslationPickerOpen(true)}
      showLayout={commentaryAvailable}
      layoutLabel={layoutNow?.label}
      LayoutIcon={layoutNow?.icon}
      onLayout={() => setLayoutPickerOpen(true)}
      showCompare={translation !== "kjv"}
      compareOn={compareWithKjv}
      onToggleCompare={toggleCompare}
      studyMode={studyMode}
      onToggleStudy={toggleStudyMode}
    />
  );

  const verseTextProps = {
    verses,
    headings,
    // ESV/NLT psalm titles arrive in headings under "_sup:<verse>" (see
    // lib/bibleProviders.js); KJV/BSB carry theirs as flagged tokens.
    superscriptions: Object.fromEntries(
      Object.entries(headings || {})
        .filter(([k]) => k.startsWith("_sup:"))
        .map(([k, v]) => [k.slice(5), v])
    ),
    highlights,
    notes: myNotes,
    tags,
    selection,
    selectedRange: verseMenu,
    studyMode: studyMode && wordStudyAvailable,
    // Verse numbers get a dotted underline -- the same visual language
    // as a tappable Strong's word -- only when there's no word-level
    // tap available, so people notice the number itself is now the way
    // in to word meanings for this verse.
    hintStrongsOnNumber: studyMode && !wordStudyAvailable,
    footnotes,
    wordTapMode,
    speakingToken,
    fontClass: FONT_OPTIONS.find((f) => f.id === bibleFont)?.className || "font-bible-sans",
    onWordTap,
    onSpeakWord: speakWord,
    onVerseNumberTap,
    onSelectTap,
  };

  const readingContent = (
    <>
      {loading && <ReaderSkeleton />}
      {error && <p className="text-sm text-accent">{error}</p>}

      {selection && (
        <div className="flex items-center justify-between bg-accent/10 text-accent text-xs rounded-lg px-3 py-2 mb-3">
          <span>
            {selection.anchor === null
              ? "Tap the first word to highlight"
              : "Now tap the last word to highlight"}
          </span>
          <button onClick={cancelHighlighting} className="font-semibold">
            Cancel
          </button>
        </div>
      )}

      {translationFallback && !loading && (
        <div className="text-xs rounded-lg px-3 py-2 mb-3 bg-accent/10 text-accent">
          Couldn&apos;t load {translationFallback.attempted} just now, so this is the King James
          Version.
        </div>
      )}

      {studyMode && verses && !loading && chapterExtras && (chapterExtras.intro || chapterExtras.themes?.length > 0) && (
        // On desktop in Study mode the Study Panel already shows this (for
        // every chapter), so the in-text card is hidden at desktop widths
        // there. Phones and Simple-desktop still get it inline.
        <div className={`rounded-xl border border-line bg-card px-4 py-3.5 mb-4 ${desktopMode ? "md:hidden" : ""}`}>
          {chapterExtras.intro && (
            <div className={chapterExtras.themes?.length ? "mb-3 pb-3 border-b border-linesoft" : ""}>
              <p className="font-serif text-base text-ink mb-2">About {chapterExtras.intro.title}</p>
              <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 mb-2.5">
                {chapterExtras.intro.summary.map((f) => (
                  <div key={f.label} className="contents">
                    <dt className="text-[0.6875rem] font-semibold text-accent pt-0.5">{f.label}</dt>
                    <dd className="text-xs text-inksoft leading-snug">{f.value}</dd>
                  </div>
                ))}
              </dl>
              <button
                onClick={() => openLibraryItem("intros", chapterExtras.intro.book)}
                className="text-xs font-medium text-accent underline underline-offset-2"
              >
                Read the full introduction
              </button>
            </div>
          )}
          {chapterExtras.themes?.length > 0 && (
            <div>
              <p className="text-[0.6875rem] text-inkfaint mb-1.5">Theme notes starting in this chapter</p>
              <div className="flex flex-wrap gap-1.5">
                {chapterExtras.themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openLibraryItem("themes", t.id)}
                    className="text-xs bg-accent/8 text-accent rounded-full px-3 py-1.5 hover:bg-accent/15"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {verses && !loading && (
        <>
          {!selection && (effectiveLayout === "text" || effectiveLayout === "split-top" || effectiveLayout === "split-side") && (
            <p className="text-[0.6875rem] text-inkfaint mb-2.5 flex items-center">
              {wordStudyAvailable
                ? "Tap an underlined word for its meaning, or a verse number for more options."
                : "Tap the underlined verse number for word meanings, related verses, and more."}
              <InfoTooltip
                text={
                  wordStudyAvailable
                    ? "Underlined words link to their original Hebrew or Greek meaning. Tapping a verse number lets you see related verses, highlight a phrase, or add a note."
                    : "The verse number is underlined because it opens Hebrew and Greek word meanings for this verse (from the King James wording), plus related verses, highlighting, and notes."
                }
              />
            </p>
          )}

          {/* Compare mode replaces the scripture/commentary split rather
              than nesting inside it -- two translations plus a commentary
              pane is unreadable on a phone. Stacks on narrow screens,
              sits side by side once there's room. */}
          {comparing ? (
            <div className="flex flex-col md:flex-row gap-4 md:h-[calc(100vh-260px)] md:min-h-[400px]">
              <ScrollPane label={activeTranslation.label} className="flex-1 min-w-0">
                <VerseText {...verseTextProps} />
              </ScrollPane>
              <ScrollPane
                label="King James Version"
                className="flex-1 min-w-0 border-t md:border-t-0 md:border-l border-line pt-3 md:pt-0 md:pl-4"
              >
                {/* No highlights on this pane: they belong to whichever
                    translation they were made in, and the ones loaded
                    here are the active translation's. */}
                <VerseText {...verseTextProps} verses={kjvVerses} studyMode={false} highlights={[]} hintStrongsOnNumber={false} footnotes={{}} />
              </ScrollPane>
            </div>
          ) : (
          <>
          {effectiveLayout === "text" && <VerseText {...verseTextProps} />}

          {effectiveLayout === "commentary" && commentaryNotes && (
            <>
              <p className="text-xs uppercase tracking-wide text-inkfaint mb-3">{commentaryLabel}</p>
              <CommentaryNotes notes={commentaryNotes} />
              {commentaryAttributionLine}
            </>
          )}

          {effectiveLayout === "split-top" && (
            <div className="flex flex-col gap-4 h-[calc(100vh-320px)] md:h-[calc(100vh-220px)] min-h-[400px]">
              <ScrollPane label="Scripture" className="flex-1 border-b border-line pb-3">
                <VerseText {...verseTextProps} />
              </ScrollPane>
              <ScrollPane label={commentaryLabel} className="flex-1">
                {commentaryNotes && <CommentaryNotes notes={commentaryNotes} />}
                {commentaryNotes && commentaryAttributionLine}
              </ScrollPane>
            </div>
          )}

          {effectiveLayout === "split-side" && (
            <div className="flex gap-4 h-[calc(100vh-320px)] md:h-[calc(100vh-220px)] min-h-[400px]">
              <ScrollPane label="Scripture" className="flex-1 min-w-0">
                <VerseText {...verseTextProps} />
              </ScrollPane>
              <ScrollPane label={commentaryLabel} className="flex-1 min-w-0 border-l border-line pl-4">
                {commentaryNotes && <CommentaryNotes notes={commentaryNotes} />}
                {commentaryNotes && commentaryAttributionLine}
              </ScrollPane>
            </div>
          )}
          </>
          )}

          {/* REQUIRED. Crossway and Tyndale both make displaying their
              copyright notice a condition of the licence that lets this
              app show their text at all. Don't remove it, and don't
              hide it behind a tap. */}
          {copyright && (
            <p className="text-[0.625rem] leading-relaxed text-inkfaint mt-6 pt-3 border-t border-line">
              {copyright}
              {attributionUrl && (
                <>
                  {" "}
                  <a
                    href={attributionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {attributionUrl.replace(/^https?:\/\//, "")}
                  </a>
                </>
              )}
            </p>
          )}
        </>
      )}
    </>
  );

  const verseActionBarShowing = verseMenu !== null && !popup && !selection && !colorPickerFor && !noteEditor && !tagEditor;
  const verseActionBar = verseActionBarShowing && (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-line shadow-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-3xl mx-auto px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-ink">
            {ABBR_TO_NAME[book]} {chapter}:
            {verseMenu.start === verseMenu.end ? verseMenu.start : `${verseMenu.start}-${verseMenu.end}`}
            {verseMenu.start !== verseMenu.end && (
              <span className="text-xs font-normal text-inkfaint ml-1.5">
                — tap another verse to extend
              </span>
            )}
          </p>
          <button onClick={() => setVerseMenu(null)} className="text-inkfaint p-1" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {/* Available in every translation: cross-references are keyed
              by verse, not by word, so they resolve the same whatever
              you're reading. Only the Matthew Henry section inside the
              popup is hidden off-KJV. Highlight, Note and Tag also work
              everywhere -- highlights are stored per-translation
              (migration_032); notes and tags attach to verse ranges and
              carry across. */}
          <button
            onClick={() => showCrossRefs(verseMenu)}
            className="flex flex-col items-center gap-1 text-inkfaint px-3 py-1.5 flex-shrink-0"
          >
            <Link2 size={18} />
            <span className="text-[0.6875rem]">Cross-refs</span>
          </button>
          {/* Only when the on-screen text has NO word-level Strong's of
              its own (esv/nlt). kjv and bsb both carry Strong's per word
              already -- tapping the word itself is the way in for those,
              so this button would be redundant (and worse: it would
              route through KJV's wording even when you're already
              reading a translation that has its own alignment). */}
          {!wordStudyAvailable && (
          <button
            onClick={() => showVerseStrongs(verseMenu)}
            className="flex flex-col items-center gap-1 text-inkfaint px-3 py-1.5 flex-shrink-0"
          >
            <BookOpen size={18} />
            <span className="text-[0.6875rem]">Strong&apos;s</span>
          </button>
          )}
          <button
            onClick={() => startHighlighting(verseMenu)}
            className="flex flex-col items-center gap-1 text-inkfaint px-3 py-1.5 flex-shrink-0"
          >
            <Highlighter size={18} />
            <span className="text-[0.6875rem]">Highlight</span>
          </button>
          <button
            onClick={() => openNoteEditor(verseMenu)}
            className="flex flex-col items-center gap-1 text-inkfaint px-3 py-1.5 flex-shrink-0"
          >
            <StickyNote size={18} />
            <span className="text-[0.6875rem]">{rangeNote(verseMenu) ? "Edit note" : "Note"}</span>
          </button>
          <button
            onClick={() => setTagEditor({ start: verseMenu.start, end: verseMenu.end })}
            className="flex flex-col items-center gap-1 text-inkfaint px-3 py-1.5 flex-shrink-0"
          >
            <Tag size={18} />
            <span className="text-[0.6875rem]">{rangeTags(verseMenu).length > 0 ? "Edit tags" : "Tag"}</span>
          </button>
          <button
            onClick={() => copyVerseRange(verseMenu)}
            className="flex flex-col items-center gap-1 text-inkfaint px-3 py-1.5 flex-shrink-0"
          >
            {copiedVerse === `${verseMenu.start}-${verseMenu.end}` ? (
              <>
                <Check size={18} className="text-accent" />
                <span className="text-[0.6875rem] text-accent">Copied</span>
              </>
            ) : (
              <>
                <Copy size={18} />
                <span className="text-[0.6875rem]">Copy</span>
              </>
            )}
          </button>
          {rangeHasHighlights(verseMenu) && (
            <button
              onClick={() => clearRangeHighlights(verseMenu)}
              className="flex flex-col items-center gap-1 text-accent px-3 py-1.5 flex-shrink-0"
            >
              <Trash2 size={18} />
              <span className="text-[0.6875rem]">Unhighlight</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const colorPickerPopup = colorPickerFor && (
    <StudyPopup title="Choose a highlight color" onClose={() => setColorPickerFor(null)}>
      <div className="flex gap-3 justify-center py-2">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.id}
            onClick={() => saveHighlight(c.id)}
            className="w-11 h-11 rounded-full border-2 border-line"
            style={{ backgroundColor: c.swatch }}
            aria-label={c.id}
          />
        ))}
      </div>
    </StudyPopup>
  );

  const noteEditorPopup = noteEditor && (
    <NoteEditorPopup
      verseStart={noteEditor.verseStart}
      verseEnd={noteEditor.verseEnd}
      bookName={ABBR_TO_NAME[book]}
      chapter={chapter}
      initialText={noteEditor.existing?.text || ""}
      hasExisting={!!noteEditor.existing}
      onClose={() => setNoteEditor(null)}
      onSave={saveNote}
      onDelete={deleteNote}
    />
  );

  const tagEditorPopup = tagEditor != null && (
    <StudyPopup
      title={`Tags — ${ABBR_TO_NAME[book]} ${chapter}:${
        tagEditor.start === tagEditor.end ? tagEditor.start : `${tagEditor.start}-${tagEditor.end}`
      }`}
      onClose={() => setTagEditor(null)}
    >
      <div>
        {rangeTags(tagEditor).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {rangeTags(tagEditor).map((t) => {
              return (
                <span
                  key={t.id}
                  className={`flex items-center gap-1.5 text-xs font-semibold rounded-full pl-3 pr-2 py-1.5 ${tagColorClass(t.tag)}`}
                >
                  {t.tag}
                  <button onClick={() => removeTag(t.id)} aria-label={`Remove tag ${t.tag}`}>
                    <X size={13} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            placeholder="e.g. prayer, encouragement"
            className="sp-input text-sm flex-1"
          />
          <button onClick={addTag} className="sp-btn-primary text-sm px-4">
            Add
          </button>
        </div>
      </div>
    </StudyPopup>
  );

  const layoutPickerPopup = layoutPickerOpen && (
    <StudyPopup title="Reading Layout" onClose={() => setLayoutPickerOpen(false)}>
      <div className="space-y-1">
        {LAYOUTS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              chooseLayout(id);
              setLayoutPickerOpen(false);
            }}
            className="w-full flex items-center gap-3 text-left py-2.5 text-sm text-ink"
          >
            <Icon size={16} className={layout === id ? "text-accent" : "text-inkfaint"} />
            {label}
            {layout === id && <Check size={16} className="text-accent ml-auto" />}
          </button>
        ))}
      </div>
      {/* Applies to BOTH the layouts above (whenever one shows
          commentary) and the Cross-refs & Commentary popup from a verse
          tap -- one choice, used everywhere commentary appears. */}
      <div className="mt-4 pt-4 border-t border-line">
        <p className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-2">Commentary Source</p>
        {[
          {
            id: "tyndale",
            label: "Tyndale Study Notes",
            hint: "Modern scholarship, written to work with any translation",
          },
          {
            id: "matthew-henry",
            label: "Matthew Henry",
            hint: "Classic 18th-century commentary, quotes King James wording",
          },
        ].map(({ id, label, hint }) => (
          <button
            key={id}
            onClick={() => chooseCommentarySource(id)}
            className="w-full text-left py-2 flex items-start gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink">{label}</p>
              <p className="text-[0.6875rem] text-inkfaint">{hint}</p>
            </div>
            {commentarySource === id && <Check size={16} className="text-accent mt-0.5 flex-shrink-0" />}
          </button>
        ))}
      </div>
    </StudyPopup>
  );

  const bookChapterPickerPopup = bookChapterPickerOpen && (
    <StudyPopup title="Go to Book & Chapter" onClose={() => setBookChapterPickerOpen(false)}>
      <div className="space-y-3">
        {(() => {
          const recent = getRecentPassages().filter((p) => !(p.bookAbbr === book && p.chapter === chapter));
          if (recent.length === 0) return null;
          return (
            <div>
              <p className="text-xs uppercase tracking-wide text-inkfaint mb-1.5">Recently Viewed</p>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((p) => (
                  <button
                    key={`${p.bookAbbr}-${p.chapter}`}
                    onClick={() => {
                      setBook(p.bookAbbr);
                      setChapter(p.chapter);
                      setBookChapterPickerOpen(false);
                    }}
                    className="text-xs bg-paper border border-line rounded-full px-3 py-1.5 text-inksoft"
                  >
                    {ABBR_TO_NAME[p.bookAbbr] || p.bookAbbr} {p.chapter}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
        <select
          value={book}
          onChange={(e) => {
            setBook(e.target.value);
            setChapter(1);
          }}
          className="sp-input text-sm w-full"
        >
          {BOOKS.map(([abbr, name]) => (
            <option key={abbr} value={abbr}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={chapter}
          onChange={(e) => setChapter(parseInt(e.target.value, 10))}
          className="sp-input text-sm w-full"
        >
          {Array.from({ length: chapterCounts[book] || chapter }, (_, i) => i + 1).map((c) => (
            <option key={c} value={c}>
              Chapter {c}
            </option>
          ))}
        </select>
        <button onClick={() => setBookChapterPickerOpen(false)} className="sp-btn-primary w-full text-sm">
          Go
        </button>
      </div>
    </StudyPopup>
  );

  const fontPickerPopup = fontPickerOpen && (
    <StudyPopup title="Reading Font" onClose={() => setFontPickerOpen(false)}>
      <div className="space-y-2">
        {FONT_OPTIONS.map((f) => (
          <button
            key={f.id}
            onClick={() => chooseBibleFont(f.id)}
            className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left ${
              bibleFont === f.id ? "border-accent bg-accent/8" : "border-line"
            }`}
          >
            <span className={`text-base text-ink ${f.className}`}>
              In the beginning, God created — {f.label}
            </span>
            {bibleFont === f.id && <Check size={16} className="text-accent flex-shrink-0 ml-2" />}
          </button>
        ))}
      </div>
    </StudyPopup>
  );

  const ttsPopup = ttsOpen && (
    <StudyPopup title="Listen" onClose={() => setTtsOpen(false)}>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-ink mb-2">Read this chapter aloud</p>
          <div className="flex gap-2">
            {!chapterPlaying ? (
              <button onClick={playChapter} className="sp-btn-primary flex-1 text-sm flex items-center justify-center gap-2">
                <Play size={16} /> Play chapter
              </button>
            ) : (
              <>
                {chapterPaused ? (
                  <button
                    onClick={resumeChapter}
                    className="sp-btn-primary flex-1 text-sm flex items-center justify-center gap-2"
                  >
                    <Play size={16} /> Resume
                  </button>
                ) : (
                  <button
                    onClick={pauseChapter}
                    className="sp-btn-primary flex-1 text-sm flex items-center justify-center gap-2"
                  >
                    <Pause size={16} /> Pause
                  </button>
                )}
                <button
                  onClick={stopChapter}
                  className="flex items-center justify-center gap-2 text-sm font-semibold text-accent border border-line rounded-lg px-4"
                >
                  <Square size={15} /> Stop
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-inkfaint mt-2">
            Follows along, highlighting each word as it's spoken.
          </p>
        </div>

        {voices.length > 0 && (
          <div className="pt-3 border-t border-linesoft">
            <p className="text-sm font-semibold text-ink mb-1.5">Voice</p>
            <select
              value={selectedVoiceURI || ""}
              onChange={(e) => chooseVoice(e.target.value)}
              className="sp-input text-sm"
            >
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-inkfaint mt-2">
              Available voices depend on your device — quality varies by phone or computer.
            </p>
          </div>
        )}
      </div>
    </StudyPopup>
  );

  const jumpBar = jumpOpen && (
    <div className="bg-card border border-line rounded-xl p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-2 flex-1 mr-2">
          <button
            onClick={() => setJumpTab("goto")}
            className={`flex-1 text-xs font-semibold rounded-full px-3 py-1.5 ${
              jumpTab === "goto" ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
            }`}
          >
            Go to reference
          </button>
          <button
            onClick={() => setJumpTab("find")}
            className={`flex-1 text-xs font-semibold rounded-full px-3 py-1.5 ${
              jumpTab === "find" ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
            }`}
          >
            Find in this chapter
          </button>
        </div>
        <button onClick={() => setJumpOpen(false)} className="text-inkfaint flex-shrink-0" aria-label="Close search">
          <X size={18} />
        </button>
      </div>

      {jumpTab === "goto" ? (
        <>
          <input
            type="text"
            autoFocus
            value={jumpInput}
            onChange={(e) => {
              setJumpInput(e.target.value);
              setJumpError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && jumpToReference()}
            placeholder="e.g. John 3:16, or Gen 1"
            className="sp-input text-sm mb-2"
          />
          {jumpError && <p className="text-xs text-accent mb-2">{jumpError}</p>}
          <button onClick={jumpToReference} className="sp-btn-primary w-full text-sm">
            Go
          </button>
        </>
      ) : (
        <>
          <input
            type="text"
            autoFocus
            value={findQuery}
            onChange={(e) => {
              setFindQuery(e.target.value);
              setFindIndex(0);
            }}
            onKeyDown={(e) => e.key === "Enter" && goToFindMatch(findIndex)}
            placeholder="Find a word or phrase…"
            className="sp-input text-sm mb-2"
          />
          {findQuery.trim() && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-inkfaint">
                {findMatches.length === 0
                  ? "No matches"
                  : `${findIndex + 1} of ${findMatches.length} match${findMatches.length === 1 ? "" : "es"}`}
              </p>
              {findMatches.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => goToFindMatch(findIndex - 1)}
                    className="text-xs font-semibold text-accent px-2 py-1"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => goToFindMatch(findIndex + 1)}
                    className="text-xs font-semibold text-accent px-2 py-1"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  const translationPickerPopup = translationPickerOpen && (
    <StudyPopup title="Translation" onClose={() => setTranslationPickerOpen(false)}>
      <div className="space-y-1.5">
        {TRANSLATIONS.map((t) => (
          <button
            key={t.id}
            onClick={() => chooseTranslation(t.id)}
            className={`w-full text-left rounded-lg px-3 py-2.5 border ${
              t.id === translation
                ? "border-accent/50 bg-accent/10"
                : "border-line bg-paper"
            }`}
          >
            <span className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-ink">{t.label}</span>
              <span className="text-xs text-inkfaint truncate">{t.fullName}</span>
            </span>
            <span className="block text-[0.6875rem] text-inkfaint mt-0.5">
              {translationCapabilityText(t)}
            </span>
          </button>
        ))}
      </div>
      <p className="text-[0.6875rem] text-inkfaint mt-3 leading-relaxed">
        Hebrew and Greek word meanings (tapping an underlined word) are tied to the King James
        and Berean Standard Bible&apos;s own word-by-word tagging, so they&apos;re shown only on
        those two. Cross-references and commentary (Tyndale Study Notes by default, or Matthew
        Henry — change this under Reading Layout) work on every translation.
      </p>
    </StudyPopup>
  );

  const summaryList = (summary, size = "sm") =>
    summary?.length > 0 && (
      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5">
        {summary.map((f) => (
          <div key={f.label} className="contents">
            <dt className={`${size === "sm" ? "text-[0.6875rem]" : "text-xs"} font-semibold text-accent pt-0.5`}>{f.label}</dt>
            <dd className={`${size === "sm" ? "text-xs" : "text-sm"} text-inksoft leading-snug`}>{f.value}</dd>
          </div>
        ))}
      </dl>
    );

  // Full book introduction, shown in the reading area itself.
  const introReadingPane = introView && (
    <article className="max-w-2xl">
      <button
        onClick={() => setIntroView(null)}
        className="flex items-center gap-1.5 text-xs font-medium text-inkfaint mb-4 hover:text-ink"
      >
        <ChevronLeft size={14} />
        Back to {ABBR_TO_NAME[book]} {chapter}
      </button>
      <p className="text-xs text-inkfaint mb-1">Introduction</p>
      <h2 className="font-serif text-3xl text-ink mb-4 leading-tight">{introView.title}</h2>
      <div className="mb-5 pb-5 border-b border-linesoft">{summaryList(introView.summary, "md")}</div>
      <RichContent blocks={introView.blocks} onRef={goToReference} />
      <TyndaleAttribution />
      <button
        onClick={() => {
          setIntroView(null);
          if (!(book === introView.id && chapter === 1)) {
            setBook(introView.id);
            setChapter(1);
          }
        }}
        className="mt-6 text-xs font-semibold rounded-full px-4 py-2 bg-accent text-white"
      >
        {book === introView.id && chapter === 1 ? `Continue to ${introView.title} 1` : `Start reading ${introView.title}`}
      </button>
    </article>
  );

  const mainReading = (content) => (introView ? introReadingPane : content);

  // What the desktop Study Panel shows when nothing has been tapped yet:
  // context for the chapter on screen, instead of an empty prompt.
  // `book` is the summary for every chapter; `intro` (chapter 1 only) is
  // the same data, so it's a safe fallback if an older cached response
  // without `book` ever reaches the client.
  const panelBook = chapterExtras?.book || chapterExtras?.intro || null;

  const chapterContextPanel = (
    <div>
      {panelBook && (
        <div className="mb-5">
          <p className="font-serif text-base text-ink mb-2">About {panelBook.title}</p>
          <div className="mb-2.5">{summaryList(panelBook.summary)}</div>
          <button
            onClick={() => openLibraryItem("intros", panelBook.book)}
            className="text-xs font-medium text-accent underline underline-offset-2"
          >
            Read the full introduction
          </button>
        </div>
      )}
      {(chapterExtras?.themes?.length > 0 || chapterExtras?.activeThemes?.length > 0) && (
        <div className="mb-5 pt-4 border-t border-linesoft">
          {chapterExtras.themes?.length > 0 && (
            <>
              <p className="text-[0.6875rem] text-inkfaint mb-1.5">Theme notes starting here</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {chapterExtras.themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openLibraryItem("themes", t.id)}
                    className="text-xs bg-accent/8 text-accent rounded-full px-3 py-1.5 hover:bg-accent/15"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </>
          )}
          {chapterExtras.activeThemes?.length > 0 && (
            <>
              <p className="text-[0.6875rem] text-inkfaint mb-1.5">Continuing through this chapter</p>
              <div className="flex flex-wrap gap-1.5">
                {chapterExtras.activeThemes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openLibraryItem("themes", t.id)}
                    className="text-xs border border-line text-inksoft rounded-full px-3 py-1.5 hover:border-accent/40"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 text-inkfaint pt-4 border-t border-linesoft">
        <MousePointerClick size={16} strokeWidth={1.5} className="opacity-60 flex-shrink-0" />
        <p className="text-xs">Tap an underlined word or a verse number to see study info here.</p>
      </div>
    </div>
  );

  const libraryPopupContent = popup?.type === "library" && popup.item && (
    <div>
      {popup.item.ref && (
        <button
          onClick={() => goToReference(`${popup.item.ref.book} ${popup.item.ref.c1}:${popup.item.ref.v1}`)}
          className="text-xs font-medium rounded-full px-3 py-1.5 bg-accent/8 text-accent mb-3"
        >
          Go to {ABBR_TO_NAME[popup.item.ref.book]} {popup.item.ref.c1}:{popup.item.ref.v1}
        </button>
      )}
      <RichContent blocks={popup.item.blocks} onRef={goToReference} />
      <TyndaleAttribution />
    </div>
  );

  const studyPopupBlock = (
    <>
      {popup && (
        <StudyPopup
          title={
            popup.type === "verse-range"
              ? `${commentaryAvailable ? "Cross-references & Commentary" : "Cross-references"} — ${
                  ABBR_TO_NAME[book]
                } ${chapter}:${popup.start === popup.end ? popup.start : `${popup.start}-${popup.end}`}`
              : popup.type === "verse-strongs"
              ? `Strong's — ${ABBR_TO_NAME[book]} ${chapter}:${
                  popup.start === popup.end ? popup.start : `${popup.start}-${popup.end}`
                }`
              : popup.type === "library"
              ? popup.item?.title || "Study Notes"
              : "Word Study"
          }
          onClose={() => setPopup(null)}
        >
          {popup.type === "loading" && <PopupSkeleton />}
          {popup.type === "error" && <p className="text-sm text-accent">{popup.message}</p>}
          {popup.type === "word" && popup.entry && (
            <WordStudyContent entry={popup.entry} id={popup.id} dictMatches={popup.dictMatches} />
          )}
          {popup.type === "verse-range" && (
            <CrossRefRangeContent
              perVerse={popup.perVerse}
              onGoTo={goToReference}
              showCommentary={commentaryAvailable}
              commentaryLabel={commentaryLabel}
              commentaryAttribution={commentarySource === "tyndale"}
            />
          )}
          {popup.type === "library" && libraryPopupContent}
          {popup.type === "verse-strongs" && (
            <VerseStrongsContent
              perVerse={popup.perVerse}
              translationLabel={activeTranslation.label}
              onWordTap={onWordTap}
            />
          )}
        </StudyPopup>
      )}
      {verseActionBarShowing && <div className="h-24" aria-hidden="true" />}
      {verseActionBar}
      {colorPickerPopup}
      {noteEditorPopup}
      {tagEditorPopup}
      {ttsPopup}
      {fontPickerPopup}
      {bookChapterPickerPopup}
      {layoutPickerPopup}
      {translationPickerPopup}
    </>
  );

  return (
    <>
      {desktopMode && studyMode && (
        <div className="hidden md:block px-8 lg:px-12 pt-4 pb-6 max-w-[1600px] mx-auto">
          {/* Reserve space on the right for the fixed study panel, so content
              never runs underneath it. Split layouts want the extra room to
              actually show two panels side by side; single-column layouts
              stay narrower for readability. */}
          <div
            className={
              layout === "split-top" || layout === "split-side" ? "" : "max-w-3xl"
            }
            style={{ marginRight: 500 }}
          >
            {controls}
            {jumpBar}
            {mainReading(readingContent)}
          </div>

          {/* Fixed (not sticky) so it reliably stays in place regardless of
              how tall the surrounding chapter text gets -- sticky's "stuck"
              behavior is bounded by its own parent's height, which caused it
              to break free and scroll away partway down a long chapter.
              Top offset clears the app's own sticky header (roughly 57px
              tall) with some breathing room; bottom padding respects the
              safe area on devices that need it. */}
          <div
            className="fixed right-0 w-[460px] border-l border-line bg-paper overflow-y-auto"
            style={{
              top: "calc(env(safe-area-inset-top) + 4.5rem)",
              height: "calc(100vh - env(safe-area-inset-top) - 4.5rem)",
              paddingTop: "1.25rem",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
              paddingLeft: "1.75rem",
              paddingRight: "1.75rem",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wide text-inkfaint">Study Panel</p>
              {popup && (
                <button onClick={() => setPopup(null)} className="text-inkfaint">                  <X size={16} />
                </button>
              )}
            </div>
            {!popup && chapterContextPanel}
            {popup?.type === "library" && popup.item && (
              <>
                <p className="font-serif text-lg text-ink mb-2 leading-snug">{popup.item.title}</p>
                {libraryPopupContent}
              </>
            )}
            {popup?.type === "loading" && <PopupSkeleton />}
            {popup?.type === "error" && <p className="text-sm text-accent">{popup.message}</p>}
            {popup?.type === "word" && popup.entry && (
                <WordStudyContent entry={popup.entry} id={popup.id} dictMatches={popup.dictMatches} />
              )}
            {popup?.type === "verse-range" && (
              <>
                <p className="text-sm text-ink font-medium mb-2">
                  {commentaryAvailable ? "Cross-references & Commentary" : "Cross-references"} —{" "}
                  {ABBR_TO_NAME[book]} {chapter}:
                  {popup.start === popup.end ? popup.start : `${popup.start}-${popup.end}`}
                </p>
                <CrossRefRangeContent
                  perVerse={popup.perVerse}
                  onGoTo={goToReference}
                  showCommentary={commentaryAvailable}
                  commentaryLabel={commentaryLabel}
                  commentaryAttribution={commentarySource === "tyndale"}
                />
              </>
            )}
            {popup?.type === "verse-strongs" && (
              <>
                <p className="text-sm text-ink font-medium mb-2">
                  Strong&apos;s — {ABBR_TO_NAME[book]} {chapter}:
                  {popup.start === popup.end ? popup.start : `${popup.start}-${popup.end}`}
                </p>
                <VerseStrongsContent
                  perVerse={popup.perVerse}
                  translationLabel={activeTranslation.label}
                  onWordTap={onWordTap}
                />
              </>
            )}
          </div>
          {verseActionBarShowing && <div className="h-32" aria-hidden="true" />}
          {verseActionBar}
          {colorPickerPopup}
          {noteEditorPopup}
          {tagEditorPopup}
          {ttsPopup}
          {fontPickerPopup}
          {bookChapterPickerPopup}
          {layoutPickerPopup}
          {translationPickerPopup}
            </div>
      )}

      {desktopMode && !studyMode && (
        <div className="hidden md:block px-8 lg:px-12 pt-4 pb-6 max-w-[1600px] mx-auto">
          {/* Simple mode has no word-study detail to show, so there's nothing
              worth reserving side-panel space for -- let the text use the
              full width instead. Split layouts get the full 1600px container;
              single-column layouts stay narrower for readability. */}
          <div
            className={
              layout === "split-top" || layout === "split-side" ? "" : "max-w-4xl mx-auto"
            }
          >
            {controls}
            {jumpBar}
            {mainReading(readingContent)}
          </div>
          {studyPopupBlock}
        </div>
      )}

      <div className={desktopMode ? "md:hidden px-5 pt-4 pb-6" : "px-5 pt-4 pb-6"}>
        {controls}
            {jumpBar}
        {mainReading(readingContent)}
        {studyPopupBlock}
      </div>
    </>
  );
}

function NoteEditorPopup({ verseStart, verseEnd, bookName, chapter, initialText, hasExisting, onClose, onSave, onDelete }) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onSave(text);
    } finally {
      setSaving(false);
    }
  };

  const reference = verseStart === verseEnd ? `${verseStart}` : `${verseStart}-${verseEnd}`;

  return (
    <StudyPopup title={`Note — ${bookName} ${chapter}:${reference}`} onClose={onClose}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write your note here..."
        rows={5}
        className="sp-input text-sm resize-none mb-3"
        autoFocus
      />
      <div className="flex gap-2">
        {hasExisting && (
          <button onClick={onDelete} className="sp-btn-secondary flex-shrink-0 px-3">
            <Trash2 size={16} />
          </button>
        )}
        <button onClick={handleSave} disabled={saving || !text.trim()} className="sp-btn-primary flex-1">
          {saving ? "Saving..." : "Save Note"}
        </button>
      </div>
    </StudyPopup>
  );
}
