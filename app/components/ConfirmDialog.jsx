"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Modal from "./Modal";

// v71 #39 -- replaces every window.confirm(). The browser's confirm box
// can't be styled, can't say what it's about beyond one string, is blocked
// in some in-app browsers and home-screen apps, and reads as an error
// dialog. This one names the thing being deleted and labels the button
// with the actual action ("Delete", "Remove", "Clear messages"), not
// "OK".
//
//   const confirm = useConfirm();
//   if (!(await confirm({
//     title: `Delete "Amazing Grace"?`,
//     message: "It will also be removed from any setlists it's in.",
//     confirmLabel: "Delete",
//   }))) return;
//
// `destructive` (default true) makes the confirm button red and puts the
// initial focus on Cancel, so a stray Enter can't delete something.

const ConfirmContext = createContext(null);

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  // Outside a provider fall back to the native box rather than doing nothing.
  return confirm || (async ({ title, message }) => (typeof window === "undefined" ? false : window.confirm([title, message].filter(Boolean).join("\n\n"))));
}

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const pending = useRef(null);

  const settle = useCallback((result) => {
    const resolve = pending.current;
    pending.current = null;
    setRequest(null);
    resolve?.(result);
  }, []);

  const confirm = useCallback((options) => {
    // A second confirm() while one is open cancels the first.
    pending.current?.(false);
    return new Promise((resolve) => {
      pending.current = resolve;
      setRequest({ destructive: true, confirmLabel: "Confirm", cancelLabel: "Cancel", ...options });
    });
  }, []);

  useEffect(
    () => () => {
      pending.current?.(false);
    },
    []
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && <ConfirmDialog {...request} onResolve={settle} />}
    </ConfirmContext.Provider>
  );
}

export default function ConfirmDialog({ title, message, confirmLabel, cancelLabel, destructive, onResolve }) {
  return (
    <Modal
      title={title}
      role="alertdialog"
      width="popup"
      maxHeight="70vh"
      z={100}
      closeLabel="Close"
      headingClassName="font-serif text-lg text-ink m-0 min-w-0"
      onClose={() => onResolve(false)}
    >
      {message && <p className="text-sm text-inksoft mb-4 leading-relaxed">{message}</p>}
      <div className="flex gap-2 justify-end mt-2">
        <button
          type="button"
          data-autofocus={destructive ? "" : undefined}
          onClick={() => onResolve(false)}
          className="sp-btn-secondary min-h-[44px]"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          data-autofocus={destructive ? undefined : ""}
          onClick={() => onResolve(true)}
          className={`min-h-[44px] px-4 rounded-lg font-medium text-sm ${
            destructive ? "bg-red-600 text-white hover:bg-red-700" : "sp-btn-primary"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
