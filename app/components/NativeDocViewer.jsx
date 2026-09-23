"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ExternalLink, ZoomIn, ZoomOut } from "lucide-react";
import { toDirectDownloadUrl } from "@/lib/songMedia";

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5; // combined with the devicePixelRatio cap above, keeps worst-case canvas size bounded
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Renders Sheet Music/Lyrics/Chords inline -- PDFs with our own PDF.js
 * canvas rendering, and Word documents (.docx) with docx-preview,
 * which lays a .docx out into the same kind of paginated "pages" a PDF
 * has (not a literal PDF conversion, but the same page-by-page reading
 * experience). Which renderer to use is decided by the actual
 * Content-Type the proxy returns, not a file extension -- a Drive link
 * never has one -- so this always fetches the bytes first, then
 * branches.
 *
 * PDF and DOCX need different zoom strategies internally: a PDF page
 * is an expensive bitmap re-render on every scale change, so pinch
 * only updates a free CSS transform live and commits one real re-render
 * on release (see the PDF-specific effect below). A docx-preview page
 * is plain HTML/CSS, cheap to scale, so its zoom just updates a CSS
 * transform directly on every touch event with no separate commit step.
 *
 * Falls back to a plain iframe pointed at the same proxy URL for
 * anything that's neither -- the proxy itself redirects to Google's
 * /preview on failure (see that route's comment), so the fallback
 * iframe still shows something even then.
 */
export default function NativeDocViewer({ url }) {
  const containerRef = useRef(null);
  const canvasRefs = useRef([]); // pdf.js canvases, one per page
  const docxContainerRef = useRef(null); // docx-preview renders into this
  const docxPageRefs = useRef([]); // <section class="docx"> elements, one per page, found after render
  const pdfDocRef = useRef(null);
  const renderTokenRef = useRef(0);
  const renderTasksRef = useRef([]);
  const activeRenderPromiseRef = useRef(null); // the currently in-flight page.render() promise, if any -- see cleanup below
  const pinchRef = useRef(null);
  const pendingPinchScaleRef = useRef(null);

  const [kind, setKind] = useState("loading"); // "loading" | "pdf" | "docx" | "fallback"
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [scale, setScale] = useState(null);
  const [livePinchScale, setLivePinchScale] = useState(1); // pdf-only: live visual feedback during a pinch, separate from the committed `scale`

  const directUrl = toDirectDownloadUrl(url);

  // Fetches the bytes ourselves with a plain fetch() -- same mechanism
  // every other part of the app already uses successfully against this
  // same proxy -- rather than handing a library a URL and letting its
  // own network layer manage the request (pdf.js's own fetch/XHR
  // stream doesn't reliably include the session cookie the proxy
  // requires, even for a same-origin request). Branches on the
  // response's actual Content-Type to decide which renderer to use.
  useEffect(() => {
    if (!directUrl) {
      setKind("fallback");
      return;
    }
    let cancelled = false;
    setKind("loading");
    setNumPages(0);
    setCurrentPage(1);
    setPageInput("1");
    setScale(null);

    (async () => {
      try {
        const res = await fetch(directUrl);
        if (!res.ok) throw new Error(`Proxy responded ${res.status}`);
        const contentType = res.headers.get("content-type") || "";
        const data = await res.arrayBuffer();
        if (cancelled) return;

        if (contentType.includes(DOCX_MIME)) {
          await loadDocx(data);
        } else {
          // Default to the PDF path even if the content-type header is
          // missing/generic (some proxies omit it) -- pdf.js's own
          // parse failure is still caught below and falls back cleanly
          // if this guess is wrong.
          await loadPdf(data);
        }
      } catch (err) {
        console.error("NativeDocViewer: falling back to Google's viewer —", err);
        if (!cancelled) setKind("fallback");
      }
    })();

    async function loadPdf(data) {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const doc = await pdfjsLib.getDocument({ data }).promise;
      if (cancelled) return;
      pdfDocRef.current = doc;
      canvasRefs.current = new Array(doc.numPages).fill(null);
      setNumPages(doc.numPages);

      // Fit page 1's natural width to the actual available width of
      // the scroll container, so the page fills the screen sensibly.
      const firstPage = await doc.getPage(1);
      const naturalWidth = firstPage.getViewport({ scale: 1 }).width;
      const available = (containerRef.current?.clientWidth || 400) - 16;
      const fitScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, available / naturalWidth));
      if (cancelled) return;
      setScale(fitScale);
      setKind("pdf");
    }

    async function loadDocx(data) {
      const docxPreview = await import("docx-preview");
      const hostEl = docxContainerRef.current;
      if (!hostEl) throw new Error("docx container not mounted");
      // Rendered into a shadow root, not directly into the app's own
      // DOM -- the app's global Tailwind CSS reset zeroes out default
      // heading/paragraph/list styling on every element (by design,
      // for the app's own UI), but that reset was ALSO stripping the
      // Word document's own default appearance, since it applied to
      // this content too as a plain descendant. A shadow root's
      // contents are genuinely style-isolated from the rest of the
      // page, so only docx-preview's own generated <style> (which
      // renderAsync puts inside this same container since no separate
      // styleContainer is passed) applies here -- the doc renders with
      // its real formatting instead of the app's UI styling bleeding
      // into it. scrollIntoView, IntersectionObserver, and querying
      // elements all still work normally across a shadow boundary, so
      // nothing else about the page-navigation logic below needs to
      // change for this.
      let shadowRoot = hostEl.shadowRoot;
      if (!shadowRoot) shadowRoot = hostEl.attachShadow({ mode: "open" });
      const shadowBody = document.createElement("div");
      shadowRoot.replaceChildren(shadowBody);
      await docxPreview.renderAsync(data, shadowBody, undefined, {
        inWrapper: true,
        breakPages: true,
        ignoreLastRenderedPageBreak: false,
      });
      if (cancelled) return;
      const pages = Array.from(shadowBody.querySelectorAll("section.docx"));
      docxPageRefs.current = pages;
      setNumPages(pages.length || 1);
      setScale(1);
      setKind("docx");
    }

    return () => {
      cancelled = true;
      // Deliberately does NOT call renderTask.cancel() or destroy the
      // document while a page.render() is actively in flight -- that
      // combination (tearing down mid-paint) is what was crashing the
      // whole page at the browser level on some devices, not something
      // catchable as a JS error. Instead, wait for whatever's currently
      // painting to finish or fail naturally, then clean up. The
      // renderTokenRef check inside renderAllPages already stops it
      // from starting any FURTHER pages once cancelled is true, so
      // there's at most one render left to wait out, not the whole
      // remaining page list.
      const doc = pdfDocRef.current;
      pdfDocRef.current = null;
      const pending = activeRenderPromiseRef.current;
      const destroy = () => doc?.destroy();
      if (pending) {
        pending.catch(() => {}).then(destroy);
      } else {
        destroy();
      }
    };
  }, [directUrl]);

  // PDF-only: renders (or re-renders, on a scale change) every page.
  // Renders each canvas at `scale * devicePixelRatio` internally but
  // sizes it on-screen at plain `scale`, so text stays crisp on
  // high-DPI screens instead of the browser stretching a low-res
  // bitmap. The whole per-page block is wrapped in one try/catch and
  // explicitly cancels any in-flight RenderTask for that same page
  // before starting a fresh one -- pdf.js rejects a second concurrent
  // render on one canvas, so without this, a fast scale change
  // (several renders fired in quick succession) would pile up
  // colliding renders that silently fail one after another, leaving
  // the page looking frozen. Unmounting entirely (closing this viewer)
  // is handled separately, in the loading effect's cleanup above --
  // deliberately NOT by cancelling here, since interrupting an active
  // paint specifically at that moment was what could crash the whole
  // page at the browser level.
  const renderAllPages = useCallback(async () => {
    const doc = pdfDocRef.current;
    if (!doc || !scale) return;
    const token = ++renderTokenRef.current;
    // Capped at 2 rather than using the raw devicePixelRatio (which can
    // be 3 on some phones) -- combined with a high zoom `scale`, an
    // uncapped multiplier can produce a canvas large enough to strain
    // GPU/memory limits, which is a real crash risk (a canvas that big
    // failing isn't a catchable JS error, it can take the whole page
    // down at the browser level). 2x is still sharp on a Retina screen;
    // the marginal crispness beyond that isn't worth the risk.
    const outputScale = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    for (let i = 1; i <= doc.numPages; i++) {
      if (renderTokenRef.current !== token) return;
      const canvas = canvasRefs.current[i - 1];
      if (!canvas) continue;
      try {
        renderTasksRef.current[i - 1]?.cancel();
        const page = await doc.getPage(i);
        if (renderTokenRef.current !== token) return;
        const viewport = page.getViewport({ scale });
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const ctx = canvas.getContext("2d");
        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
        const task = page.render({ canvasContext: ctx, viewport, transform });
        renderTasksRef.current[i - 1] = task;
        activeRenderPromiseRef.current = task.promise;
        try {
          await task.promise;
        } finally {
          if (activeRenderPromiseRef.current === task.promise) activeRenderPromiseRef.current = null;
        }
      } catch {
        return;
      }
      if (renderTokenRef.current !== token) return;
    }
  }, [scale]);

  useEffect(() => {
    if (kind === "pdf" && scale) renderAllPages();
  }, [kind, scale, renderAllPages]);

  // Keeps the page-number box in sync while scrolling, for either
  // renderer -- whichever page has the most visible area becomes
  // "current".
  useEffect(() => {
    if ((kind !== "pdf" && kind !== "docx") || !containerRef.current) return;
    const pageEls = kind === "pdf" ? canvasRefs.current : docxPageRefs.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries.reduce(
          (best, e) => (e.intersectionRatio > (best?.intersectionRatio || 0) ? e : best),
          null
        );
        if (mostVisible?.isIntersecting) {
          const idx = pageEls.indexOf(mostVisible.target);
          if (idx !== -1) {
            setCurrentPage(idx + 1);
            setPageInput(String(idx + 1));
          }
        }
      },
      { root: containerRef.current, threshold: [0.5] }
    );
    pageEls.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [kind, numPages]);

  const jumpToPage = (n) => {
    const target = Math.min(Math.max(1, n), numPages);
    const pageEls = kind === "pdf" ? canvasRefs.current : docxPageRefs.current;
    pageEls[target - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitPageInput = (e) => {
    e.preventDefault();
    const n = parseInt(pageInput, 10);
    if (Number.isFinite(n)) jumpToPage(n);
    else setPageInput(String(currentPage));
  };

  const zoomBy = (delta) => setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s + delta).toFixed(2))));

  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Custom pinch-to-zoom, attached as real (non-React-synthetic) event
  // listeners so preventDefault actually works (React's onTouchMove is
  // passive by default, which silently ignores it). Combined with this
  // element's `touch-action: pan-y`, single-finger scroll stays native
  // but a two-finger pinch is entirely ours.
  //
  // For a PDF page, a fast pinch firing many events per second would
  // otherwise trigger a full, expensive re-render on every single one,
  // which collide and stall out well before the gesture feels "done" --
  // so touchmove here only updates a free CSS transform, and the one
  // real re-render is committed on touchend. A docx page is cheap plain
  // HTML/CSS, so there's no such cost: its scale updates directly and
  // continuously with no separate commit step.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || (kind !== "pdf" && kind !== "docx")) return;

    const handleTouchStart = (e) => {
      if (e.touches.length !== 2) return;
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchRef.current = { startDist: dist, startScale: scaleRef.current };
      pendingPinchScaleRef.current = null;
    };
    const handleTouchMove = (e) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = dist / pinchRef.current.startDist;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(pinchRef.current.startScale * ratio).toFixed(2)));
      if (kind === "docx") {
        setScale(nextScale);
      } else {
        pendingPinchScaleRef.current = nextScale;
        setLivePinchScale(nextScale / pinchRef.current.startScale);
      }
    };
    const handleTouchEnd = () => {
      pinchRef.current = null;
      if (kind === "pdf") {
        setLivePinchScale(1);
        if (pendingPinchScaleRef.current != null) {
          setScale(pendingPinchScaleRef.current);
          pendingPinchScaleRef.current = null;
        }
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [kind]);

  if (kind === "fallback") {
    if (directUrl) {
      return <iframe src={directUrl} className="w-full h-full border-0" />;
    }
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-inkfaint">This link can't be previewed inline.</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="sp-btn-secondary flex items-center gap-1.5">
          Open <ExternalLink size={13} />
        </a>
      </div>
    );
  }

  const showToolbar = (kind === "pdf" || kind === "docx") && numPages > 0;

  return (
    <div className="h-full flex flex-col">
      {showToolbar && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-linesoft flex-shrink-0 bg-card">
          <form onSubmit={submitPageInput} className="flex items-center gap-1.5">
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={submitPageInput}
              inputMode="numeric"
              className="w-10 text-center text-xs border border-line rounded px-1 py-0.5 bg-paper text-ink"
            />
            <span className="text-xs text-inkfaint">/ {numPages}</span>
          </form>
          <div className="flex items-center gap-1">
            <button onClick={() => zoomBy(-0.2)} className="p-1 text-inkfaint" aria-label="Zoom out">
              <ZoomOut size={16} />
            </button>
            <span className="text-xs text-inkfaint w-9 text-center">{Math.round((scale || 1) * 100)}%</span>
            <button onClick={() => zoomBy(0.2)} className="p-1 text-inkfaint" aria-label="Zoom in">
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        style={{ touchAction: "pan-y" }}
        className="flex-1 min-h-0 overflow-auto bg-paper flex flex-col items-center py-3"
      >
        {kind === "loading" && <p className="text-sm text-inkfaint py-6">Loading…</p>}

        {/* PDF pages: live pinch feedback is a CSS transform on this
            wrapper only (not the scroll container itself, which would
            distort its own scroll math mid-gesture). Hidden (not
            unmounted) when showing docx, so pdf.js state isn't lost if
            the url ever toggles between file types. */}
        <div
          style={{
            display: kind === "pdf" ? undefined : "none",
            transform: `scale(${livePinchScale})`,
            transformOrigin: "top center",
          }}
          className="flex flex-col items-center gap-3"
        >
          {Array.from({ length: kind === "pdf" ? numPages : 0 }).map((_, i) => (
            <canvas
              key={i}
              data-page={i + 1}
              ref={(el) => (canvasRefs.current[i] = el)}
              className="shadow-sm bg-white"
            />
          ))}
        </div>

        {/* docx-preview renders directly into this div itself (it
            builds its own DOM, not React-controlled children), so it's
            always present in the tree -- just hidden via CSS when a
            pdf is what's actually showing. */}
        <div
          ref={docxContainerRef}
          style={{
            display: kind === "docx" ? undefined : "none",
            transform: `scale(${scale || 1})`,
            transformOrigin: "top center",
          }}
        />
      </div>
    </div>
  );
}
