"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import Modal from "./Modal";
import { useConfirm } from "./ConfirmDialog";
import { useAction } from "./useAction";
import { requestJson } from "@/lib/request";

// v71 #28 -- "Manage series": create and delete series in one place, with how
// many sermons each holds, and a plain statement that deleting a series never
// deletes its sermons. (Series used to be deletable only through small links
// under the filter, and creatable only while posting a sermon.)
export default function SermonSeriesSheet({ series, onClose, onChanged }) {
  const confirm = useConfirm();
  const run = useAction();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const { ok } = await run(() => requestJson("/api/sermon-series", { method: "POST", body: { name: trimmed } }), {
      success: `Series "${trimmed}" created`,
    });
    setBusy(false);
    if (ok) {
      setName("");
      onChanged();
    }
  };

  // A count that isn't a number means "not known" (a browser can briefly hold an
  // older copy of the series list from before counts existed) -- that must never
  // be shown as "0 sermons".
  const countKnown = (s) => typeof s.sermon_count === "number";

  const remove = async (s) => {
    const n = s.sermon_count;
    const yes = await confirm({
      title: `Delete the series "${s.name}"?`,
      message: !countKnown(s)
        ? "Any sermons in it will NOT be deleted — they just become ungrouped."
        : n > 0
          ? `The ${n === 1 ? "1 sermon" : `${n} sermons`} in it will NOT be deleted — ${n === 1 ? "it" : "they"} just become${n === 1 ? "s" : ""} ungrouped.`
          : "It has no sermons in it. Nothing else is affected.",
      confirmLabel: "Delete series",
    });
    if (!yes) return;
    const { ok } = await run(() => requestJson(`/api/sermon-series/${s.id}`, { method: "DELETE" }), {
      success: `Series "${s.name}" deleted`,
    });
    if (ok) onChanged(s.id);
  };

  return (
    <Modal title="Manage series" onClose={onClose} z={60} maxHeight="85vh">
      <p className="text-sm text-inksoft mt-0 mb-4">
        A series groups related sermons. Deleting a series never deletes its sermons — they stay, just ungrouped.
      </p>

      <form onSubmit={add} className="flex gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <label htmlFor="new-series-name" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">
            New series
          </label>
          <input
            id="new-series-name"
            data-autofocus=""
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="sp-input"
          />
        </div>
        <button type="submit" disabled={!name.trim() || busy} aria-busy={busy || undefined} className="sp-btn-sage self-end min-h-[44px] disabled:opacity-60">
          {busy ? "Adding…" : "Add"}
        </button>
      </form>

      <h3 className="text-xs uppercase tracking-wide text-inkfaint mt-5 mb-2">Your series</h3>
      {series.length === 0 && <p className="text-sm text-inkfaint">No series yet.</p>}
      <ul className="list-none p-0 m-0 space-y-2">
        {series.map((s) => (
          <li key={s.id} className="sp-card flex items-center justify-between gap-2 py-2.5">
            <span className="min-w-0">
              <span className="block text-sm text-ink truncate">{s.name}</span>
              {countKnown(s) && (
                <span className="block text-xs text-inkfaint">
                  {s.sermon_count} {s.sermon_count === 1 ? "sermon" : "sermons"}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => remove(s)}
              className="text-xs text-red-600 dark:text-red-400 underline flex items-center gap-1 min-h-[44px] px-1"
              aria-label={`Delete series ${s.name}`}
            >
              <Trash2 size={12} aria-hidden="true" /> Delete
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
