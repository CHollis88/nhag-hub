"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// v71 #38 -- the one dialog / bottom-sheet component. Every popup in the
// app (Profile, Settings, What's New, Help, Notifications, study popups,
// confirmations...) used to be its own hand-rolled `fixed inset-0` div with
// no accessibility behavior at all. This gives all of them, for free:
//
//   * role="dialog" + aria-modal + a real, labelled title
//   * Escape closes it (only the TOP-most one, when dialogs stack)
//   * focus moves in when it opens, is trapped while it's open (Tab and
//     Shift+Tab cycle inside), and returns to whatever opened it on close
//   * the page behind can't scroll (counted, so stacked dialogs unlock it
//     only when the last one closes)
//   * safe-area padding so nothing hides under the iPhone home indicator
//   * a close button that says what it closes ("Close Settings")
//
// Rendered in a portal on <body>, so it can never be clipped or re-stacked
// by whatever component happened to open it.
//
// width: "sheet" (default) is a full-width bottom sheet -- what the old
//        popups were; "popup" is the compact card the study popups use
//        (centered from `sm` up).
// Give an element inside `data-autofocus` to choose what gets focus first;
// otherwise it's the first field/button in the content, else the close button.

const openStack = []; // ids of open modals, top-most last
let scrollLocks = 0;
let savedOverflow = "";

function lockScroll() {
  if (scrollLocks++ === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
}
function unlockScroll() {
  if (--scrollLocks === 0) document.body.style.overflow = savedOverflow;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
}

export default function Modal({
  title,
  onClose,
  children,
  role = "dialog",
  width = "sheet",
  maxHeight = "85vh",
  z = 60,
  closeLabel,
  headingClassName = "font-serif text-xl text-ink m-0 min-w-0 truncate",
  panelClassName = "",
  padding = "p-6",
}) {
  const titleId = useId();
  const idRef = useRef(null);
  const panelRef = useRef(null);
  const contentRef = useRef(null);
  const closeBtnRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const downOnBackdrop = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return undefined;
    const id = Symbol("modal");
    idRef.current = id;
    openStack.push(id);
    lockScroll();

    const opener = document.activeElement;

    // Initial focus.
    const content = contentRef.current;
    const target =
      content?.querySelector("[data-autofocus]") ||
      (content ? focusableIn(content)[0] : null) ||
      closeBtnRef.current ||
      panelRef.current;
    target?.focus?.({ preventScroll: true });

    const onKeyDown = (e) => {
      if (openStack[openStack.length - 1] !== id) return; // not the top-most dialog
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const items = focusableIn(panelRef.current);
        if (items.length === 0) {
          e.preventDefault();
          panelRef.current.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const i = openStack.indexOf(id);
      if (i !== -1) openStack.splice(i, 1);
      unlockScroll();
      if (opener && typeof opener.focus === "function" && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [mounted]);

  if (!mounted) return null;

  const isPopup = width === "popup";
  const overlay = isPopup ? "items-end sm:items-center justify-center" : "items-end";
  const panelWidth = isPopup ? "w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl" : "w-full rounded-t-2xl";

  return createPortal(
    <div
      className={`fixed inset-0 bg-black/40 flex ${overlay}`}
      style={{ zIndex: z }}
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onTouchStart={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Only a press that STARTED and ENDED on the backdrop closes it, so
        // dragging a text selection out of the panel doesn't dismiss it.
        if (e.target === e.currentTarget && downOnBackdrop.current) onClose?.();
        downOnBackdrop.current = false;
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-card ${panelWidth} overflow-y-auto overscroll-contain outline-none ${padding} ${panelClassName}`}
        style={{
          maxHeight,
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex justify-between items-center mb-3 gap-2">
          <h2 id={titleId} className={headingClassName}>
            {title}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="text-inkfaint flex-shrink-0 p-1 -mr-1"
            aria-label={closeLabel || (typeof title === "string" ? `Close ${title}` : "Close")}
          >
            <X size={22} />
          </button>
        </div>
        <div ref={contentRef}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
