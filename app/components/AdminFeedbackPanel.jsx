"use client";

import { useEffect, useState, useCallback } from "react";

// Self-contained toggle-open panel, same collapse pattern as the
// Activity Log section it sits next to in the Toolbox.
export default function AdminFeedbackPanel() {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/feedback");
    const data = await res.json();
    if (res.ok) setFeedback(data.feedback);
  }, []);

  useEffect(() => {
    if (open && feedback === null) load();
  }, [open, feedback, load]);

  const resolve = async (id) => {
    setFeedback((prev) => prev.filter((f) => f.id !== id));
    await fetch(`/api/admin/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: true }),
    });
  };

  return (
    <div className="mt-6">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center justify-between w-full mb-2">
        <p className="text-xs uppercase tracking-wide text-inkfaint">Feedback</p>
        <span className="text-xs text-inkfaint">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="space-y-1.5">
          {feedback === null && <p className="text-sm text-inkfaint">Loading…</p>}
          {feedback?.length === 0 && <p className="text-sm text-inkfaint">No unresolved feedback.</p>}
          {feedback?.map((f) => (
            <div key={f.id} className="sp-card py-2.5">
              <p className="text-sm text-ink whitespace-pre-wrap mb-1.5">{f.message}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-inkfaint">
                  {f.is_anonymous ? "Anonymous" : f.users?.display_name || "Unknown"}
                  {f.groups?.name && ` · ${f.groups.name}`}
                  {" · "}{new Date(f.created_at).toLocaleDateString()}
                </span>
                <button onClick={() => resolve(f.id)} className="text-xs text-accent underline flex-shrink-0">
                  Mark resolved
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
