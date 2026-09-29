"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import EmptyState from "./EmptyState";
import { SkeletonRowList } from "./Skeleton";
import Modal from "./Modal";

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
    <Modal title="Group Progress" onClose={onClose} z={60} maxHeight="85vh">
      <p className="text-xs text-inkfaint mb-5">
        How the class is doing on the Bible Plan. Each person's percentage is relative to whichever
        plan they're on.
      </p>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!error && roster === null && <SkeletonRowList count={4} />}
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
    </Modal>
  );
}
