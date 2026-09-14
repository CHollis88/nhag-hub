"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  Search,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Tag,
  Volume2,
  Play,
  Pause,
  Square,
  Ear,
  Type,
} from "lucide-react";
import { BOOKS, ABBR_TO_NAME, formatReference, parseQuickReference } from "@/lib/bibleRef";
import { addRecentPassage, getRecentPassages } from "@/lib/recentPassages";
import { getDesktopMode } from "@/lib/desktopMode";
import { api } from "@/lib/api";
import StudyPopup from "./StudyPopup";
import InfoTooltip from "./InfoTooltip";
import { cleanOccurrences } from "@/lib/lexiconFormat";
import { tagColorClass } from "@/lib/tagColor";

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

function VerseText({ verses, headings, highlights, notes, tags, selection, selectedRange, studyMode, wordTapMode, speakingToken, fontClass, onWordTap, onSpeakWord, onVerseNumberTap, onSelectTap }) {
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
          const heading = headings[num];

          return (
            <div key={num}>
              {heading && (
                <p className="font-serif text-lg text-accent font-semibold mt-7 mb-2.5 first:mt-0">{heading}</p>
              )}
              <p
                id={`verse-${verseNum}`}
                className={`text-[0.9375rem] md:text-base leading-relaxed text-ink scroll-mt-24 rounded ${
                  isInActiveRange ? "bg-accent/10" : ""
                }`}
              >
              <button
                onClick={() => onVerseNumberTap(verseNum)}
                className="text-xs align-super text-accent font-semibold mr-1"
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
              {tokens.map((tok, i) => {
                const highlight = verseHighlights.find((h) => {
                  const lo = h.verse_start === verseNum ? h.start_pos : 0;
                  const hi = h.verse_end === verseNum ? h.end_pos : Infinity;
                  return i >= lo && i <= hi;
                });
                const isPicked = isSelecting && selection.anchor?.verse === verseNum && selection.anchor?.wordIndex === i;
                const isSpeaking = speakingToken?.verse === verseNum && speakingToken?.index === i;
                const style = highlight ? { backgroundColor: HIGHLIGHT_BG[highlight.color] } : undefined;
                const hasStrongs = studyMode && tok.s.length > 0;

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
                    className={
                      isPicked
                        ? "ring-2 ring-accent rounded"
                        : isSpeaking
                        ? "bg-accent/25 rounded"
                        : ""
                    }
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
                    )}{" "}
                  </span>
                );
              })}
              </p>
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
            {n.v1 === n.v2 ? `Verse ${n.v1}` : `Verses ${n.v1}-${n.v2}`}
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CrossRefRangeContent({ perVerse, onGoTo }) {
  // The underlying commentary data is itself stored as verse ranges (e.g.
  // one entry covering verses 1-3), so fetching per verse can return the
  // exact same entry more than once. Dedupe by its own v1/v2 range rather
  // than by verse, and show it once, together, after all the cross-refs.
  const seen = new Set();
  const allCommentary = [];
  for (const { commentary } of perVerse) {
    if (!commentary) continue;
    for (const c of commentary) {
      const key = `${c.v1}-${c.v2}`;
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

      {allCommentary.length > 0 && (
        <div className="mt-6 pt-4 border-t border-line">
          <p className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-2">
            Matthew Henry's Commentary
          </p>
          <div className="space-y-3">
            {allCommentary.map((c, i) => (
              <p key={i} className="text-sm text-inksoft leading-relaxed">
                {c.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PassageReader({ initialBook = "Gen", initialChapter = 1, deviceId }) {
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
  const [pendingScroll, setPendingScroll] = useState(null);
  const [copiedVerse, setCopiedVerse] = useState(null);

  useEffect(() => {
    setLayout(getPref("sp_bible_layout", "text"));
    setStudyModeState(getPref("sp_bible_study_mode", "study") !== "simple");
    setBibleFontState(getPref("sp_bible_font", "sans"));
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
    try {
      const d = await api.getPassage(book, chapter);
      setVerses(d.verses);
      setHeadings(d.headings || {});
    } catch (err) {
      setError(err.message || "Couldn't load that passage.");
    } finally {
      setLoading(false);
    }
  }, [book, chapter]);

  useEffect(() => {
    load();
  }, [load]);

  // Once a chapter finishes loading, scroll to a specific verse if one was
  // requested (via jump-to-reference or a cross-reference link).
  useEffect(() => {
    if (!verses || pendingScroll == null) return;
    const el = document.getElementById(`verse-${pendingScroll}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setPendingScroll(null);
  }, [verses, pendingScroll]);

  // While a chapter is being read aloud, keep the currently-spoken verse in view.
  useEffect(() => {
    if (!speakingToken) return;
    const el = document.getElementById(`verse-${speakingToken.verse}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [speakingToken?.verse]);

  useEffect(() => {
    if (layout === "commentary" || layout === "split-top" || layout === "split-side") {
      api.getCommentary(book, chapter).then((d) => setCommentaryNotes(d.notes));
    }
  }, [book, chapter, layout]);

  const loadMyData = useCallback(() => {
    if (!deviceId) return;
    api.getHighlights(deviceId, book, chapter).then((d) => setHighlights(d.highlights || []));
    api.getNotes(deviceId, book, chapter).then((d) => setMyNotes(d.notes || []));
    api.getTags(deviceId, book, chapter).then((d) => setTags(d.tags || []));
  }, [deviceId, book, chapter]);

  useEffect(() => {
    loadMyData();
  }, [loadMyData]);

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

  const showCrossRefs = async (range) => {
    setPopup({ type: "loading" });
    try {
      const verseNums = [];
      for (let v = range.start; v <= range.end; v++) verseNums.push(v);
      const perVerse = await Promise.all(
        verseNums.map((v) =>
          api.getCrossRefs(book, chapter, v).then((d) => ({ verse: v, refs: d.refs, commentary: d.commentary }))
        )
      );
      setPopup({ type: "verse-range", start: range.start, end: range.end, perVerse });
    } catch {
      setPopup({ type: "error", message: "Couldn't load cross-references." });
    }
  };

  const changeChapter = (delta) => {
    const newChapter = chapter + delta;
    if (newChapter < 1) return;
    setChapter(newChapter);
  };

  const goToReference = (ref) => {
    const m = ref.match(/^(\w+)\s+(\d+):(\d+)/);
    if (!m) return;
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
      if (tokens) parts.push(tokens.map((t) => t.t).join(" "));
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
      .filter(([, tokens]) => tokens.map((t) => t.t).join(" ").toLowerCase().includes(q))
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
    try {
      await api.addHighlight({
        device_id: deviceId,
        book,
        chapter,
        verse_start: colorPickerFor.verseStart,
        verse_end: colorPickerFor.verseEnd,
        start_pos: colorPickerFor.start_pos,
        end_pos: colorPickerFor.end_pos,
        color,
      });
      loadMyData();
    } finally {
      setColorPickerFor(null);
    }
  };

  const clearRangeHighlights = async (range) => {
    // Removes any highlight that overlaps the selected range at all, not
    // just ones matching it exactly -- "clear what I've selected" is the
    // more intuitive reading than requiring an exact range match.
    const toRemove = highlights.filter((h) => h.verse_start <= range.end && h.verse_end >= range.start);
    await Promise.all(toRemove.map((h) => api.removeHighlight(h.id, deviceId)));
    loadMyData();
  };

  const openNoteEditor = (range) => {
    const existing = myNotes.find((n) => n.verse_start === range.start && n.verse_end === range.end);
    setNoteEditor({ verseStart: range.start, verseEnd: range.end, existing: existing || null });
  };

  const saveNote = async (text) => {
    if (!noteEditor || !deviceId) return;
    await api.saveNote({
      device_id: deviceId,
      book,
      chapter,
      verse_start: noteEditor.verseStart,
      verse_end: noteEditor.verseEnd,
      text,
    });
    setNoteEditor(null);
    loadMyData();
  };

  const deleteNote = async () => {
    if (!noteEditor?.existing || !deviceId) return;
    await api.removeNote(noteEditor.existing.id, deviceId);
    setNoteEditor(null);
    loadMyData();
  };

  const addTag = async () => {
    const tag = tagInput.trim();
    if (!tag || !deviceId || !tagEditor) return;
    await api.addTag({
      device_id: deviceId,
      book,
      chapter,
      verse_start: tagEditor.start,
      verse_end: tagEditor.end,
      tag,
    });
    setTagInput("");
    loadMyData();
  };

  const removeTag = async (id) => {
    if (!deviceId) return;
    await api.removeTag(id, deviceId);
    loadMyData();
  };

  const buildSpokenChapterData = () => {
    if (!verses) return null;
    const verseNums = Object.keys(verses).map(Number).sort((a, b) => a - b);
    const flatTokens = [];
    let text = "";
    for (const vNum of verseNums) {
      verses[vNum].forEach((tok, i) => {
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

  const controls = (
    <div className="sticky top-0 z-20 bg-paper pt-1 pb-1 -mx-5 px-5 md:mx-0 md:px-0">
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <button onClick={() => changeChapter(-1)} className="text-inkfaint p-1.5 flex-shrink-0" aria-label="Previous chapter">
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => setBookChapterPickerOpen(true)}
          className="sp-input text-sm flex items-center justify-center gap-1.5 flex-1 min-w-0"
        >
          <span className="truncate">
            {ABBR_TO_NAME[book]} {chapter}
          </span>
          <ChevronDown size={14} className="opacity-60 flex-shrink-0" />
        </button>
        <button onClick={() => changeChapter(1)} className="text-inkfaint p-1.5 flex-shrink-0" aria-label="Next chapter">
          <ChevronRight size={18} />
        </button>
        <button
          onClick={() => setTtsOpen(true)}
          className={`p-1.5 flex-shrink-0 ${chapterPlaying ? "text-accent" : "text-inkfaint"}`}
          aria-label="Listen to this chapter"
        >
          <Volume2 size={18} />
        </button>
        <button
          onClick={() => setWordTapMode(!wordTapMode)}
          className={`p-1.5 flex-shrink-0 ${wordTapMode ? "text-accent" : "text-inkfaint"}`}
          aria-label="Tap a word to hear it"
          title={wordTapMode ? "Tap-a-word is on" : "Tap-a-word is off"}
        >
          <Ear size={18} />
        </button>
        <button
          onClick={() => setJumpOpen(true)}
          className="text-inkfaint p-1.5 flex-shrink-0"
          aria-label="Jump to a reference or find in this chapter"
        >
          <Search size={18} />
        </button>
        <button
          onClick={() => setFontPickerOpen(true)}
          className="text-inkfaint p-1.5 flex-shrink-0"
          aria-label="Change reading font"
        >
          <Type size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
        <button
          onClick={() => setLayoutPickerOpen(true)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-paper text-inkfaint border border-line"
        >
          {(() => {
            const current = LAYOUTS.find((l) => l.id === layout);
            const Icon = current?.icon || AlignLeft;
            return (
              <>
                <Icon size={14} />
                {current?.label || "Layout"}
                <ChevronDown size={12} className="opacity-60" />
              </>
            );
          })()}
        </button>
        <button
          onClick={toggleStudyMode}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-paper text-inkfaint border border-line ml-auto"
          title={studyMode ? "Showing full word-study detail. Tap to simplify." : "Simplified view. Tap for full word-study detail."}
        >
          {studyMode ? <ToggleRight size={16} className="text-accent" /> : <ToggleLeft size={16} />}
          {studyMode ? "Study" : "Simple"}
        </button>
      </div>
    </div>
  );

  const verseTextProps = {
    verses,
    headings,
    highlights,
    notes: myNotes,
    tags,
    selection,
    selectedRange: verseMenu,
    studyMode,
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
      {loading && <p className="text-sm text-inkfaint">Loading...</p>}
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

      {verses && !loading && (
        <>
          {!selection && (layout === "text" || layout === "split-top" || layout === "split-side") && (
            <p className="text-[0.6875rem] text-inkfaint mb-2.5 flex items-center">
              Tap an underlined word for its meaning, or a verse number for more options.
              <InfoTooltip text="Underlined words link to their original Hebrew or Greek meaning. Tapping a verse number lets you see related verses, highlight a phrase, or add a note." />
            </p>
          )}

          {layout === "text" && <VerseText {...verseTextProps} />}

          {layout === "commentary" && commentaryNotes && (
            <>
              <p className="text-xs uppercase tracking-wide text-inkfaint mb-3">Matthew Henry's Commentary</p>
              <CommentaryNotes notes={commentaryNotes} />
            </>
          )}

          {layout === "split-top" && (
            <div className="flex flex-col gap-4 h-[calc(100vh-320px)] md:h-[calc(100vh-220px)] min-h-[400px]">
              <ScrollPane label="Scripture" className="flex-1 border-b border-line pb-3">
                <VerseText {...verseTextProps} />
              </ScrollPane>
              <ScrollPane label="Matthew Henry's Commentary" className="flex-1">
                {commentaryNotes && <CommentaryNotes notes={commentaryNotes} />}
              </ScrollPane>
            </div>
          )}

          {layout === "split-side" && (
            <div className="flex gap-4 h-[calc(100vh-320px)] md:h-[calc(100vh-220px)] min-h-[400px]">
              <ScrollPane label="Scripture" className="flex-1 min-w-0">
                <VerseText {...verseTextProps} />
              </ScrollPane>
              <ScrollPane label="Matthew Henry's Commentary" className="flex-1 min-w-0 border-l border-line pl-4">
                {commentaryNotes && <CommentaryNotes notes={commentaryNotes} />}
              </ScrollPane>
            </div>
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
          <button
            onClick={() => showCrossRefs(verseMenu)}
            className="flex flex-col items-center gap-1 text-inkfaint px-3 py-1.5 flex-shrink-0"
          >
            <Link2 size={18} />
            <span className="text-[0.6875rem]">Cross-refs</span>
          </button>
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

  const studyPopupBlock = (
    <>
      {popup && (
        <StudyPopup
          title={
            popup.type === "verse-range"
              ? `Cross-references & Commentary — ${ABBR_TO_NAME[book]} ${chapter}:${
                  popup.start === popup.end ? popup.start : `${popup.start}-${popup.end}`
                }`
              : "Word Study"
          }
          onClose={() => setPopup(null)}
        >
          {popup.type === "loading" && <p className="text-sm text-inkfaint">Loading...</p>}
          {popup.type === "error" && <p className="text-sm text-accent">{popup.message}</p>}
          {popup.type === "word" && popup.entry && (
            <WordStudyContent entry={popup.entry} id={popup.id} dictMatches={popup.dictMatches} />
          )}
          {popup.type === "verse-range" && (
            <CrossRefRangeContent perVerse={popup.perVerse} onGoTo={goToReference} />
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
            {readingContent}
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
            {!popup && (
              <div className="flex flex-col items-center text-center py-16 text-inkfaint">
                <MousePointerClick size={24} strokeWidth={1.5} className="opacity-50 mb-2.5" />
                <p className="text-xs">Tap an underlined word or a verse number to see study info here.</p>
              </div>
            )}
            {popup?.type === "loading" && <p className="text-sm text-inkfaint">Loading...</p>}
            {popup?.type === "error" && <p className="text-sm text-accent">{popup.message}</p>}
            {popup?.type === "word" && popup.entry && (
                <WordStudyContent entry={popup.entry} id={popup.id} dictMatches={popup.dictMatches} />
              )}
            {popup?.type === "verse-range" && (
              <>
                <p className="text-sm text-ink font-medium mb-2">
                  Cross-references & Commentary — {ABBR_TO_NAME[book]} {chapter}:
                  {popup.start === popup.end ? popup.start : `${popup.start}-${popup.end}`}
                </p>
                <CrossRefRangeContent perVerse={popup.perVerse} onGoTo={goToReference} />
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
            {readingContent}
          </div>
          {studyPopupBlock}
        </div>
      )}

      <div className={desktopMode ? "md:hidden px-5 pt-4 pb-6" : "px-5 pt-4 pb-6"}>
        {controls}
            {jumpBar}
        {readingContent}
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
