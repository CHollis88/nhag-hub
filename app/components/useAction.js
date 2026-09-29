"use client";

import { useCallback } from "react";
import { useToast } from "./ToastProvider";

// v71 #8 -- the standard shape of "do this change, then tell the person how
// it went". Wrap the request; get back { ok, data, error }:
//
//   const run = useAction();
//   const { ok } = await run(
//     () => requestJson(`/api/x/${id}`, { method: "DELETE" }),
//     { success: "Deleted" }
//   );
//   if (ok) load();                 // only refresh / close forms on success
//
// On failure it shows the error as a toast (the server's own message when it
// sent one) and returns ok:false, so the caller can leave the form open and
// keep what the person typed. It never throws.
export function useAction() {
  const toast = useToast();
  return useCallback(
    async (fn, { success, failure } = {}) => {
      try {
        const data = await fn();
        if (success) toast.success(success);
        return { ok: true, data, error: null };
      } catch (error) {
        toast.error(error?.message || failure || "Couldn't save — try again.");
        return { ok: false, data: null, error };
      }
    },
    [toast]
  );
}
