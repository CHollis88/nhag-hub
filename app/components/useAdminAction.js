"use client";

import { useCallback } from "react";
import { useToast } from "./ToastProvider";
import { usePinPrompt } from "./PinPrompt";
import { requestJson } from "@/lib/request";

// v71 #21 -- runs an admin request that MIGHT need the PIN re-entered.
//
//   const runAdmin = useAdminAction();
//   const { ok } = await runAdmin(
//     () => requestJson(`/api/groups/${id}`, { method: "DELETE" }),
//     { success: "Deleted", pinTitle: "Delete Choir permanently", pinMessage: "..." }
//   );
//
// It just tries the request. If the server answers "pin_required" it asks
// for the PIN (POST /api/auth/verify-pin, with the dialog showing wrong-PIN
// and lockout messages), and then retries the SAME request once. Cancelling
// the prompt is not an error: { ok: false, cancelled: true }, no toast.
// Any other failure is a toast, as with useAction.
export function useAdminAction() {
  const toast = useToast();
  const askPin = usePinPrompt();

  return useCallback(
    async (fn, { success, pinTitle = "Confirm it's you", pinMessage = "For your security, enter your PIN to continue.", pinLabel = "Continue" } = {}) => {
      const attempt = async () => {
        const data = await fn();
        if (success) toast.success(success);
        return { ok: true, data, error: null };
      };
      try {
        return await attempt();
      } catch (err) {
        if (err?.data?.code !== "pin_required") {
          toast.error(err?.message || "Couldn't do that — try again.");
          return { ok: false, data: null, error: err };
        }
      }

      const verified = await askPin({
        title: pinTitle,
        message: pinMessage,
        confirmLabel: pinLabel,
        submit: (pin) => requestJson("/api/auth/verify-pin", { method: "POST", body: { pin } }),
      });
      if (!verified) return { ok: false, data: null, error: null, cancelled: true };

      try {
        return await attempt();
      } catch (err) {
        toast.error(err?.message || "Couldn't do that — try again.");
        return { ok: false, data: null, error: err };
      }
    },
    [toast, askPin]
  );
}
