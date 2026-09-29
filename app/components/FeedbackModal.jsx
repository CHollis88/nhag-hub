"use client";

import { useState } from "react";
import Modal from "./Modal";
import { requestJson } from "@/lib/request";

// Optionally scoped to a specific ministry (groupId) or general
// church/app feedback when groupId is omitted -- the same form either
// way, just a different payload.
export default function FeedbackModal({ groupId, onClose }) {
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy || !message.trim()) return;
    setBusy(true);
    setStatus("");
    try {
      await requestJson("/api/feedback", {
        method: "POST",
        body: { group_id: groupId || null, message, is_anonymous: anonymous },
      });
      setStatus("sent");
      setMessage("");
    } catch (err) {
      // The message stays in the box -- feedback is worth not retyping.
      setStatus(err.message || "Couldn't send feedback.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Send Feedback" onClose={onClose} z={70} maxHeight="85vh">
      {status === "sent" ? (
        <p className="text-sm text-sage">Thanks — your feedback was sent.</p>
      ) : (
        <form onSubmit={submit}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's working? What's not? Tell us anything."
            required
            rows={5}
            className="sp-textarea mb-2"
          />
          <label className="flex items-center gap-2 mb-3 text-sm text-inksoft">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            Submit anonymously
          </label>
          <button type="submit" disabled={busy} className="sp-btn-primary">
            {busy ? "Sending…" : "Send"}
          </button>
          {status && status !== "sent" && <p className="text-sm mt-2 text-red-600 dark:text-red-400">{status}</p>}
        </form>
      )}
    </Modal>
  );
}
