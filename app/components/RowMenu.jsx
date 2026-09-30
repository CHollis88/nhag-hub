"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

// v71 #33 -- a "⋯" overflow menu for a row's less-common actions, so a row
// shows ONE 44px button instead of a pair of small text links side by side
// (easy to mis-tap: "Make leader" sat right next to "Remove").
//
//   <RowMenu label="Actions for Taylor" busy={pending}
//            items={[{ label: "Make leader", onSelect: promote },
//                    { label: "Remove", onSelect: remove, destructive: true }]} />
//
// A real menu, as far as keyboards and screen readers go: the button says it
// opens a menu; the menu takes focus on its first item; Up/Down/Home/End move
// between items; Escape or clicking elsewhere closes it; choosing an item (or
// Escape) puts focus back on the ⋯ button.
// v71 polish: also serves as the "+ Add" picker. Pass triggerText to show a
// text button (styled with triggerClassName) instead of the ⋯ icon; give an
// item a `description` for a second, quieter line. Falsy items are skipped,
// so callers can write `cond && { ... }`.
export default function RowMenu({ label, items: rawItems, busy = false, disabled = false, triggerText, triggerClassName, onOpenChange, triggerRef: externalTriggerRef, triggerAttrs }) {
  const items = rawItems.filter(Boolean);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const setButtonRef = (el) => {
    buttonRef.current = el;
    if (externalTriggerRef) externalTriggerRef.current = el;
  };

  useEffect(() => {
    onOpenChange?.(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus();
    const onPointerDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onMenuKeyDown = (e) => {
    const entries = [...menuRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')];
    const at = entries.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      entries[(at + 1) % entries.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      entries[(at - 1 + entries.length) % entries.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      entries[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      entries[entries.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="relative flex-shrink-0">
      <button
        {...triggerAttrs}
        ref={setButtonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled || busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        aria-busy={busy || undefined}
        className={triggerText ? triggerClassName : "min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-inkfaint disabled:opacity-50"}
      >
        {busy ? <span aria-hidden="true">…</span> : triggerText ?? <MoreHorizontal size={20} aria-hidden="true" />}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full mt-1 z-30 min-w-[10rem] max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-card shadow-lg py-1"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                item.onSelect();
              }}
              className={`w-full text-left px-4 min-h-[44px] text-sm ${item.description ? "py-2" : ""} ${item.destructive ? "text-red-600 dark:text-red-400" : "text-ink"}`}
            >
              {item.label}
              {item.description && <span className="block text-xs text-inkfaint font-normal">{item.description}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
