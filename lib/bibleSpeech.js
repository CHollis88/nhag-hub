// v71.25 -- Read Aloud engine, kept OUTSIDE React so it keeps going when you
// leave the Bible screen (the little bar at the bottom controls it from
// anywhere). The reader builds the chapter's text pieces and hands them over;
// this file speaks them one short piece at a time, remembers the word it was
// on (so Pause really pauses), and tells subscribers what changed.
//
// Why short pieces: Android refuses long text, Chrome's online voices cut out
// after ~15 s, and the browser's own pause() acts like Stop on many phones.

const st = {
  gen: 0,
  chunks: null,
  chunk: 0,
  offset: 0,
  fails: 0,
  active: false, // reading or paused (a reading "session" exists)
  paused: false,
  token: null, // { verse, index } being spoken
  message: "",
  key: null, // "book:chapter:translation" being read
  book: null,
  chapter: null,
  label: "",
  rate: 0.95,
  voiceURI: null,
  readerMounted: false,
  sheetOpen: false,
  openRequest: 0,
};

let snapshot = { ...st, hasChunks: false };
const listeners = new Set();
let utterance = null; // keep a reference: Chrome can drop a speaking utterance that gets garbage-collected
let onChapterEnd = null;

function emit() {
  snapshot = { ...st, chunks: undefined, hasChunks: Boolean(st.chunks) };
  listeners.forEach((l) => l());
}

export const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const getSnapshot = () => snapshot;
export const getServerSnapshot = () => snapshot;

const synth = () => (typeof window !== "undefined" ? window.speechSynthesis : null);
const findOffsetToken = (tokens, charIndex) => {
  let match = null;
  for (const t of tokens) { if (t.offset <= charIndex) match = t; else break; }
  return match;
};

function speakChunk(gen) {
  const ss = synth();
  if (gen !== st.gen || !ss) return;
  const chunk = st.chunks?.[st.chunk];
  if (!chunk) {
    // End of the chapter: the next Play starts from verse 1.
    st.chunk = 0; st.offset = 0; st.active = false; st.paused = false; st.token = null;
    const handled = onChapterEnd ? onChapterEnd() : false;
    emit();
    return handled;
  }
  const startOffset = st.offset;
  const text = chunk.text.slice(startOffset);
  if (!text.trim()) { st.chunk += 1; st.offset = 0; return speakChunk(gen); }
  const u = new SpeechSynthesisUtterance(text);
  u.rate = st.rate;
  if (st.voiceURI) {
    const v = ss.getVoices().find((x) => x.voiceURI === st.voiceURI);
    if (v) u.voice = v;
  }
  const mark = (tok) => { st.offset = tok.offset; st.token = { verse: tok.verse, index: tok.index }; emit(); };
  u.onstart = () => {
    if (gen !== st.gen) return;
    st.fails = 0;
    const tok = findOffsetToken(chunk.tokens, startOffset);
    if (tok) mark(tok);
  };
  u.onboundary = (e) => {
    if (gen !== st.gen) return;
    if (e.name && e.name !== "word") return;
    const tok = findOffsetToken(chunk.tokens, startOffset + e.charIndex);
    if (tok) mark(tok);
  };
  u.onend = () => {
    if (gen !== st.gen) return;
    st.chunk += 1; st.offset = 0;
    speakChunk(gen);
  };
  u.onerror = (e) => {
    if (gen !== st.gen) return;
    if (e.error === "interrupted" || e.error === "canceled") return; // that was us
    st.fails += 1;
    if (st.fails >= 3) {
      st.active = false; st.paused = false;
      st.message = "This device couldn't read the chapter aloud. Try a different voice below, or try again.";
      emit();
      return;
    }
    st.chunk += 1; st.offset = 0;
    speakChunk(gen);
  };
  utterance = u;
  ss.speak(u);
}

function run() {
  const ss = synth();
  if (!ss || !st.chunks?.length) return;
  st.fails = 0;
  st.gen += 1;
  const gen = st.gen;
  ss.cancel();
  st.message = "";
  st.active = true;
  st.paused = false;
  emit();
  // Chrome drops a speak() made in the same instant as cancel(), so wait a beat.
  setTimeout(() => speakChunk(gen), 60);
}

export const bibleSpeech = {
  // Start (or restart) reading `chunks`. startChunk/startOffset let it begin mid-chapter.
  begin({ chunks, key, book, chapter, label, startChunk = 0, startOffset = 0 }) {
    if (!chunks?.length) return;
    st.chunks = chunks; st.key = key; st.book = book; st.chapter = chapter; st.label = label;
    st.chunk = startChunk; st.offset = startOffset; st.token = null;
    run();
  },
  resume() { if (st.chunks) run(); },
  restart() { if (!st.chunks) return; st.chunk = 0; st.offset = 0; run(); },
  pause() {
    const ss = synth();
    if (!ss || !st.active) return;
    st.gen += 1;
    ss.cancel();
    st.paused = true;
    emit();
  },
  stop() {
    const ss = synth();
    st.gen += 1;
    st.chunks = null; st.chunk = 0; st.offset = 0; st.key = null;
    st.active = false; st.paused = false; st.token = null; st.message = "";
    if (ss) ss.cancel();
    emit();
  },
  // A new speed applies at once: if it's reading, carry on from the current
  // word at the new speed (otherwise it would only change at the next piece).
  setRate(r) {
    const changed = st.rate !== r;
    st.rate = r;
    if (changed && st.active && !st.paused && st.chunks) run();
  },
  setVoice(uri) { st.voiceURI = uri; },
  setChapterEndHandler(fn) { onChapterEnd = fn; },
  setUi(patch) { Object.assign(st, patch); emit(); },
  requestOpenSheet() { st.openRequest += 1; emit(); },
  getPosition() { return { chunk: st.chunk, offset: st.offset }; },
};
