"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ExternalLink, ZoomIn, ZoomOut } from "lucide-react";
import { toDirectDownloadUrl } from "@/lib/songMedia";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

/**
 * Renders a PDF (Lyrics, Chords, Sheet Music) with our own PDF.js
 * canvas rendering, instead of relying on the browser's built-in PDF
 * viewer inside an iframe. Built specifically so:
 *  - Scrolling moves between pages (all pages render into one
 *    vertically scrolling column, standard for sheet music).
 *  - A page-number box lets you jump straight to a page.
 *  - Zoom (pinch on mobile, +/- buttons anywhere) only affects the PDF
 *    canvas, never the app around it. That's the reason for
 *    `touch-action: pan-y` on the scroll container below: it tells the
 *    browser "handle single-finger vertical scroll natively, but don't
 *    auto-handle pinch" -- which hands pinch gestures to our own touch
 *    handlers instead of the browser's page-zoom, scoped to just this
 *    element.
 *
 * Falls back to a plain iframe pointed at the same proxy URL if PDF.js
 * can't parse what came back (the proxy itself redirects to Google's
 * /preview on failure -- see that route's comment -- so the fallback
 * iframe still ends up showing something, just Google's viewer instead
 * of ours).
 */
export default function NativePdfViewer({ url }) {
  const containerRef = useRef(null);
  const canvasRefs = useRef([]);
  const pdfDocRef = useRef(null);
  const renderTokenRef = useRef(0); // bumped on every scale change to cancel stale renders
  const pinchRef = useRef(null); // { startDist, startScale } while a pinch is active

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  // null until the doc loads and we measure the container to compute a
  // fit-to-width starting scale -- using a fixed default regardless of
  // screen size is exactly what was producing the odd small-page/wide-
  // margins look, since a phone-sized container and a hardcoded 1.2
  // scale rarely match.
  const [scale, setScale] = useState(null);
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "fallback"

  const directUrl = toDirectDownloadUrl(url);

  // Load the document once per url. Fetches the bytes ourselves with a
  // plain fetch() -- same mechanism every other part of the app already
  // uses successfully against this same proxy -- rather than handing
  // pdf.js a URL and letting its own internal network layer manage the
  // request. That matters here specifically: pdf.js's own fetch/XHR
  // stream doesn't reliably include the session cookie the proxy
  // requires, even for a same-origin request, which silently produced
  // a 401 that pdf.js then failed to parse as a PDF -- immediately
  // falling back to Google's viewer even though the proxy itself (and
  // the API key behind it) were working fine, as proven by audio
  // playback working through the very same proxy.
  useEffect(() => {
    if (!directUrl) {
      setStatus("fallback");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setNumPages(0);
    setCurrentPage(1);
    setPageInput("1");

    (async () => {
      try {
        const res = await fetch(directUrl);
        if (!res.ok) throw new Error(`Proxy responded ${res.status}`);
        const data = await res.arrayBuffer();
        if (cancelled) return;

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
        // the scroll container, so the page fills the screen sensibly
        // instead of sitting at some arbitrary fixed size with big
        // gutters on either side (on a narrow phone) or tiny and
        // unreadable (on a wide one).
        const firstPage = await doc.getPage(1);
        const naturalWidth = firstPage.getViewport({ scale: 1 }).width;
        const available = (containerRef.current?.clientWidth || 400) - 16; // leaves a little breathing room
        const fitScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, available / naturalWidth));
        if (cancelled) return;
        setScale(fitScale);
        setStatus("ready");
      } catch (err) {
        // Logged (not swallowed) so a real, ongoing failure is
        // debuggable from the browser console rather than just
        // silently always showing the fallback.
        console.error("NativePdfViewer: falling back to Google's viewer —", err);
        if (!cancelled) setStatus("fallback");
      }
    })();

    return () => {
      cancelled = true;
      pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
    };
  }, [directUrl]);

  // Renders (or re-renders, on a scale change) every page. All pages
  // at once rather than lazily -- sheet music / lyrics PDFs here are
  // realistically a handful of pages, so the simpler approach is the
  // right tradeoff over building page virtualization.
  //
  // Renders each canvas at `scale * devicePixelRatio` internally, but
  // sizes it on-screen (via CSS width/height) at plain `scale` -- a
  // canvas sized only in CSS pixels renders at that same low pixel
  // count internally by default, so on any high-DPI/Retina screen the
  // browser has to stretch a blurry, under-resolved bitmap to fill a
  // sharper physical display. This is what was making the text look
  // rough regardless of zoom level.
  const renderAllPages = useCallback(async () => {
    const doc = pdfDocRef.current;
    if (!doc || !scale) return;
    const token = ++renderTokenRef.current;
    const outputScale = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    for (let i = 1; i <= doc.numPages; i++) {
      const canvas = canvasRefs.current[i - 1];
      if (!canvas) continue;
      const page = await doc.getPage(i);
      if (renderTokenRef.current !== token) return; // superseded by a newer scale change
      const viewport = page.getViewport({ scale });
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const ctx = canvas.getContext("2d");
      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
      try {
        await page.render({ canvasContext: ctx, viewport, transform }).promise;
      } catch {
        // A render task cancelled mid-flight (superseded by a newer
        // scale change) throws -- not a real error, just stale work.
      }
      if (renderTokenRef.current !== token) return;
    }
  }, [scale]);

  useEffect(() => {
    if (status === "ready" && scale) renderAllPages();
  }, [status, scale, renderAllPages]);

  // Keeps the page-number box in sync while scrolling -- whichever
  // page has the most visible area becomes "current".
  useEffect(() => {
    if (status !== "ready" || !containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries.reduce(
          (best, e) => (e.intersectionRatio > (best?.intersectionRatio || 0) ? e : best),
          null
        );
        if (mostVisible?.isIntersecting) {
          const page = Number(mostVisible.target.dataset.page);
          setCurrentPage(page);
          setPageInput(String(page));
        }
      },
      { root: containerRef.current, threshold: [0.5] }
    );
    canvasRefs.current.forEach((canvas) => canvas && observer.observe(canvas));
    return () => observer.disconnect();
  }, [status, numPages]);

  const jumpToPage = (n) => {
    const target = Math.min(Math.max(1, n), numPages);
    canvasRefs.current[target - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitPageInput = (e) => {
    e.preventDefault();
    const n = parseInt(pageInput, 10);
    if (Number.isFinite(n)) jumpToPage(n);
    else setPageInput(String(currentPage));
  };

  const zoomBy = (delta) => setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s + delta).toFixed(2))));

  // Kept in sync with `scale` via the effect below so the touch
  // handlers can read the current value without needing `scale` in
  // their own effect's dependency array (which would tear down and
  // rebind the listeners on every single touchmove during a pinch,
  // since that's exactly when scale is changing).
  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Custom pinch-to-zoom, attached as real (non-React-synthetic) event
  // listeners. This matters specifically because React attaches
  // onTouchMove as a PASSIVE listener by default -- calling
  // preventDefault() inside a passive listener is silently ignored by
  // the browser, which is exactly why pinch wasn't doing anything: the
  // handler was running, computing a new scale, but the browser's own
  // default touch handling (or just nothing visually updating in sync
  // with the gesture) wasn't actually being overridden. Attaching the
  // listener manually with { passive: false } is what makes
  // preventDefault actually take effect. Combined with this element's
  // `touch-action: pan-y` (below), pinch is fully handled by us --
  // single-finger scroll still works natively, but a two-finger pinch
  // updates only this component's own `scale` state.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || status !== "ready") return;

    const handleTouchStart = (e) => {
      if (e.touches.length !== 2) return;
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchRef.current = { startDist: dist, startScale: scaleRef.current };
    };
    const handleTouchMove = (e) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = dist / pinchRef.current.startDist;
      setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(pinchRef.current.startScale * ratio).toFixed(2))));
    };
    const handleTouchEnd = () => {
      pinchRef.current = null;
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
  }, [status]);

  if (status === "fallback") {
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

  return (
    <div className="h-full flex flex-col">
      {status === "ready" && numPages > 0 && (
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
            <span className="text-xs text-inkfaint w-9 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => zoomBy(0.2)} className="p-1 text-inkfaint" aria-label="Zoom in">
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        style={{ touchAction: "pan-y" }}
        className="flex-1 min-h-0 overflow-auto bg-paper flex flex-col items-center gap-3 py-3"
      >
        {status === "loading" && <p className="text-sm text-inkfaint py-6">Loading…</p>}
        {Array.from({ length: numPages }).map((_, i) => (
          <canvas
            key={i}
            data-page={i + 1}
            ref={(el) => (canvasRefs.current[i] = el)}
            className="shadow-sm bg-white max-w-full"
          />
        ))}
      </div>
    </div>
  );
}
