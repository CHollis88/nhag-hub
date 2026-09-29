"use client";

import { toastDuration } from "@/lib/simpleMode";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

// v71 #40 -- one place that tells the person what happened after they save
// or delete something: "Saved" / "Couldn't save — try again".
//
//   const toast = useToast();
//   toast.success("Saved");
//   toast.error(err.message);
//
// Rendered inside a live region so screen readers announce it: successes
// politely (role="status"), errors assertively (role="alert"). Errors stay
// on screen longer and can be dismissed. Sits above the bottom nav and the
// iPhone home indicator. No motion beyond a fade, and none at all when the
// person has asked for reduced motion.

const ToastContext = createContext(null);

// Safe outside a provider (unit tests, storybook-style renders): does nothing.
const NOOP = { success() {}, error() {}, info() {}, dismiss() {} };

export function useToast() {
  return useContext(ToastContext) || NOOP;
}

let nextId = 1;
const MAX_VISIBLE = 3;

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (kind, message) => {
      if (!message) return null;
      const id = nextId++;
      setToasts((list) => {
        // Same message already showing (a double-tapped failure): don't stack it.
        if (list.some((t) => t.kind === kind && t.message === message)) return list;
        return [...list, { id, kind, message }].slice(-MAX_VISIBLE);
      });
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), toastDuration(kind)) // longer in Simple mode
      );
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((h) => clearTimeout(h));
  }, []);

  const api = useMemo(
    () => ({
      success: (m) => show("success", m),
      error: (m) => show("error", m),
      info: (m) => show("info", m),
      dismiss,
    }),
    [show, dismiss]
  );

  const errors = toasts.filter((t) => t.kind === "error");
  const others = toasts.filter((t) => t.kind !== "error");

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed inset-x-0 z-[90] flex flex-col items-center gap-2 px-4 pointer-events-none"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
      >
        {/* Two always-mounted live regions: a live region must exist BEFORE
            its content changes for assistive tech to announce the change. */}
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-2 w-full">
          {others.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>
        <div role="alert" aria-live="assertive" className="flex flex-col items-center gap-2 w-full">
          {errors.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const isError = toast.kind === "error";
  return (
    <div
      className={`pointer-events-auto max-w-sm w-full flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-sm shadow-lg border toast-in ${
        isError
          ? "bg-red-50 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-100 dark:border-red-800"
          : "bg-card text-ink border-line"
      }`}
    >
      <span className="flex-1 min-w-0 break-words">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100 -mr-1 p-0.5"
        aria-label="Dismiss message"
      >
        <X size={16} />
      </button>
    </div>
  );
}
