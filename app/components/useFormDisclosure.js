"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { scrollBehavior } from "@/lib/motion";

// v71 #36 -- the "+ Add" / "Cancel" form pattern, done once and the same
// everywhere:
//
//   const form = useFormDisclosure(editingId);   // key changes when you switch what's being edited
//   <button ref={form.triggerRef} onClick={() => (form.open ? cancel() : form.show())}>{form.open ? "Cancel" : "+ Add"}</button>
//   {form.open && <form ref={form.formRef}>...</form>}
//
// What it does, so no screen has to remember to:
//   * when the form opens, focus goes to its FIRST field (and the form is
//     scrolled into view, without animation if the person prefers reduced motion);
//   * if it is re-pointed at something else while open (tapping Edit on a
//     different row), focus and scroll follow it;
//   * when it closes (saved or cancelled), focus goes back to whatever opened
//     it -- the button, or the row's Edit button (pass the element to show()) --
//     so keyboard and screen-reader users aren't dropped at the top of the page.
//     An Edit button usually gets DESTROYED while its row is being edited (the
//     row swaps its contents), so the element itself can't be refocused; give
//     it a stable name instead, `data-return-focus="song-edit-<id>"`, and the
//     new button with that name is found again once the row is back.
export function useFormDisclosure(key = null) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const formRef = useRef(null);
  const returnRef = useRef(null);
  const wasOpen = useRef(false);
  const lastKey = useRef(key);

  const returnName = useRef(null);
  const show = useCallback((fromElement) => {
    returnRef.current = fromElement || null;
    returnName.current = fromElement?.getAttribute?.("data-return-focus") || null;
    setOpen(true);
  }, []);
  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const opened = open && !wasOpen.current;
    const repointed = open && wasOpen.current && lastKey.current !== key;
    if (opened || repointed) {
      const form = formRef.current;
      const field = form?.querySelector("[data-first-field], input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])");
      field?.focus({ preventScroll: true });
      form?.scrollIntoView?.({ block: "start", behavior: scrollBehavior() });
    }
    if (!open && wasOpen.current) {
      // The element that opened it, if it survived; else the same-named button
      // (its row re-rendered); else the "+ Add" style button.
      const byName = returnName.current
        ? document.querySelector(`[data-return-focus="${returnName.current}"]`)
        : null;
      const target = returnRef.current?.isConnected ? returnRef.current : byName || triggerRef.current;
      target?.focus?.();
      returnRef.current = null;
      returnName.current = null;
    }
    wasOpen.current = open;
    lastKey.current = key;
  }, [open, key]);

  return { open, show, hide, triggerRef, formRef };
}
