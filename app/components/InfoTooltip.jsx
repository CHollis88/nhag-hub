"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

const W = 224; // tooltip width (w-56)
const M = 8;   // minimum gap to the screen edge

export default function InfoTooltip({ text }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: M, top: 0 });
  const btnRef = useRef(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const w = Math.min(W, window.innerWidth - M * 2);
      const left = Math.max(M, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - M));
      setPos({ left, top: r.bottom + 6, width: w });
    }
    setOpen((o) => !o);
  };

  // Fixed positioning would drift off its icon while scrolling -- just close.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span className="relative inline-block align-middle ml-1">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="text-inkfaint align-middle"
        aria-label="More info"
        aria-expanded={open}
      >
        <HelpCircle size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width }}
          className="z-50 bg-card border border-line rounded-lg px-3 py-2 text-xs text-inksoft leading-snug shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
