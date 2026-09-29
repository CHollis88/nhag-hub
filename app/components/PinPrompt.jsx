"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { errorMessage } from "@/lib/request";

// v71 #20 / #21 -- "Enter your PIN to continue."
//
//   const askPin = usePinPrompt();
//   const ok = await askPin({
//     title: "Turn Admin Privileges on",
//     message: "Enter your PIN to confirm it's you.",
//     confirmLabel: "Turn on",
//     submit: (pin) => requestJson("/api/auth/admin-mode", { method: "POST", body: { on: true, pin } }),
//   });
//
// `submit(pin)` does the real request and THROWS if it fails (requestJson
// does). The dialog stays open on a wrong PIN, shows the server's message
// ("That PIN isn't right. 3 tries left."), and clears the field so the
// next try starts clean. When the server says the account is locked (429)
// the field is disabled and the message says how long. Resolves true once
// submit succeeds, false if the person cancels (or presses Escape).
//
// The PIN is never stored: it lives in this component's state only while
// the dialog is open, and is cleared after every attempt.

const PinContext = createContext(null);

export function usePinPrompt() {
  return (
    useContext(PinContext) ||
    (async () => {
      throw new Error("usePinPrompt needs <PinProvider>");
    })
  );
}

export function PinProvider({ children }) {
  const [request, setRequest] = useState(null);
  const pending = useRef(null);

  const settle = useCallback((result) => {
    const resolve = pending.current;
    pending.current = null;
    setRequest(null);
    resolve?.(result);
  }, []);

  const askPin = useCallback((options) => {
    pending.current?.(false); // a newer prompt replaces an older one
    return new Promise((resolve) => {
      pending.current = resolve;
      setRequest({ confirmLabel: "Continue", ...options });
    });
  }, []);

  useEffect(
    () => () => {
      pending.current?.(false);
    },
    []
  );

  return (
    <PinContext.Provider value={askPin}>
      {children}
      {request && <PinDialog {...request} onResolve={settle} />}
    </PinContext.Provider>
  );
}

function PinDialog({ title, message, confirmLabel, submit, onResolve }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const valid = /^\d{4,8}$/.test(pin);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!valid || busyRef.current || locked) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await submit(pin);
      onResolve(true);
    } catch (err) {
      if (!mounted.current) return;
      setPin(""); // never leave a wrong PIN sitting in the box
      setError(errorMessage(err, "That didn't work. Please try again."));
      if (err?.status === 429) setLocked(true);
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      role="alertdialog"
      width="popup"
      maxHeight="80vh"
      z={110}
      closeLabel="Cancel"
      headingClassName="font-serif text-lg text-ink m-0 min-w-0"
      onClose={() => onResolve(false)}
    >
      <form onSubmit={onSubmit}>
        {message && <p className="text-sm text-inksoft mb-3 leading-relaxed">{message}</p>}
        <label className="block text-xs uppercase tracking-wide text-inkfaint mb-1" htmlFor="pin-prompt-input">
          Your PIN
        </label>
        <input
          id="pin-prompt-input"
          data-autofocus=""
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={pin}
          disabled={locked || busy}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          aria-describedby={error ? "pin-prompt-error" : undefined}
          aria-invalid={error ? true : undefined}
          className="sp-input mb-2 tracking-widest"
        />
        {error && (
          <p id="pin-prompt-error" role="alert" className="text-sm text-red-600 dark:text-red-400 mb-2">
            {error}
          </p>
        )}
        <div className="flex gap-2 justify-end mt-2">
          <button type="button" onClick={() => onResolve(false)} className="sp-btn-secondary min-h-[44px]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || busy || locked}
            aria-busy={busy || undefined}
            className="sp-btn-primary min-h-[44px] disabled:opacity-60"
          >
            {busy ? "Checking…" : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
