"use client";

import { useEffect, useState } from "react";
import { X, Flame } from "lucide-react";
import EmptyState from "./EmptyState";

export default function GroupProgressView({ groupId, onClose }) {
  const [roster, setRoster] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/groups/${groupId}/reading-progress`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setRoster(data.roster);
      });
  }, [groupId]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-t-2xl w-full max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex items-center justify-between mb-1.5">
          <p className="font-serif text-xl text-ink">Group Progress</p>
          <button onClick={onClose} className="text-inkfaint">
            <X size={22} />
          </button>
        </div>
        <p className="text-xs text-inkfaint mb-5">
          How the class is doing on the Bible Plan. Each person's percentage is relative to whichever
          plan they're on.
        </p>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!error && roster === null && <EmptyState icon={Flame} text="Loading…" />}
        {!error && roster?.length === 0 && (
          <EmptyState icon={Flame} text="No active members yet." />
        )}

        <div className="space-y-2">
          {roster?.map((person) => {
            const pct = person.totalDays > 0 ? Math.round((person.doneCount / person.totalDays) * 100) : 0;
            return (
              <div key={person.userId} className="sp-card">
                <div className="flex justify-between items-baseline mb-1.5">
                  <p className="font-serif text-base text-ink">{person.name}</p>
                  <p className="text-xs text-inkfaint">
                    {person.doneCount}/{person.totalDays} days
                  </p>
                </div>
                <div className="h-1.5 bg-linesoft rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-sage" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[0.6875rem] text-inkfaint">{person.planName}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
