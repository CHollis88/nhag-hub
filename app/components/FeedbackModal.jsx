"use client";

import { useState } from "react";

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
    setBusy(true);
    setStatus("");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: groupId || null, message, is_anonymous: anonymous }),
    });
    setBusy(false);
    if (res.ok) {
      setStatus("sent");
      setMessage("");
    } else {
      const data = await res.json();
      setStatus(data.error || "Couldn't send feedback.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-[70]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-t-2xl w-full max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex justify-between items-center mb-3 gap-2">
          <h2 className="font-serif text-xl text-ink m-0 min-w-0 truncate">Send Feedback</h2>
          <button onClick={onClose} className="text-2xl text-inkfaint leading-none flex-shrink-0">×</button>
        </div>

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
      </div>
    </div>
  );
}
