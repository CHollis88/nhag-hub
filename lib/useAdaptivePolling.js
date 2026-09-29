import { useCallback, useEffect, useRef } from "react";

// v71 #1 -- polling that costs almost nothing when nothing is happening.
//
// DM threads and group chat polled every 4 seconds, unconditionally, even
// with the app in the background. One open DM thread was ~309 requests an
// hour. This replaces that with:
//   * activeMs (10 s) while messages are arriving,
//   * idleMs (30 s) once nothing has changed for idleAfterMs (2 min),
//   * no requests at all while the page is hidden, and an immediate
//     refresh (back to the fast rate) when it becomes visible again,
//   * nudge() -- call it after sending: refreshes now and resets to the
//     fast rate.
//
// `load` must return a "signature" of the latest state (e.g. message
// count + last id). A changed signature counts as activity. Returning
// undefined means "no signal" and leaves the rate alone.
//
// `resetKey` restarts the schedule when the thing being polled changes
// (a different thread or channel).
export function useAdaptivePolling(load, { enabled = true, resetKey = null, activeMs = 10000, idleMs = 30000, idleAfterMs = 120000 } = {}) {
  const loadRef = useRef(load);
  const nudgeRef = useRef(null);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!enabled) {
      nudgeRef.current = null;
      return undefined;
    }

    let cancelled = false;
    let timer = null;
    let inFlight = false;
    let rerunAfter = false; // a nudge arrived while a poll was in flight
    let lastSig;
    let lastChange = Date.now();

    const nextDelay = () => (Date.now() - lastChange > idleAfterMs ? idleMs : activeMs);

    const run = async () => {
      clearTimeout(timer);
      if (cancelled) return;
      if (inFlight) {
        // Don't overlap requests -- but a nudge (e.g. right after sending)
        // must not be lost: poll again as soon as this one lands.
        rerunAfter = true;
        return;
      }
      if (document.visibilityState === "visible") {
        inFlight = true;
        try {
          const sig = await loadRef.current();
          if (sig !== undefined) {
            if (lastSig !== undefined && sig !== lastSig) lastChange = Date.now();
            lastSig = sig;
          }
        } catch {
          // A failed poll just waits for the next one.
        } finally {
          inFlight = false;
        }
      }
      if (cancelled) return;
      if (rerunAfter) {
        rerunAfter = false;
        run();
        return;
      }
      timer = setTimeout(run, nextDelay());
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        lastChange = Date.now();
        run();
      }
    };

    nudgeRef.current = () => {
      lastChange = Date.now();
      run();
    };

    timer = setTimeout(run, activeMs);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      nudgeRef.current = null;
    };
  }, [enabled, resetKey, activeMs, idleMs, idleAfterMs]);

  return useCallback(() => nudgeRef.current?.(), []);
}

// Signature of a message list: changes when a message is added or removed.
export function messagesSignature(messages) {
  if (!Array.isArray(messages)) return undefined;
  return `${messages.length}:${messages[messages.length - 1]?.id ?? ""}`;
}
