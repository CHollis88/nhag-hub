"use client";

import { useEffect, useState } from "react";

// Small 30-day calendar strip, driven by /api/reading-plan/dashboard --
// a compact complement to the streak/done-count cards already in
// TodayTab, using calendar dates (not plan day numbers) so it reflects
// actual daily activity even if someone is ahead of or behind their
// plan day.
export default function ReadingHistoryStrip({ planId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reading-plan/dashboard?plan_id=${planId}`)
      .then((res) => res.json())
      .then((d) => !cancelled && setData(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [planId]);

  if (!data) return null;

  return (
    <div className="mt-3">
      <p className="text-xs text-inkfaint mb-1.5">
        Last 30 days · {data.percent_complete}% of the plan complete
      </p>
      <div className="flex gap-1">
        {data.history.map((d) => (
          <div
            key={d.date}
            title={d.date}
            className={`flex-1 h-4 rounded-sm ${d.completed ? "bg-sage" : "bg-paper border border-line"}`}
          />
        ))}
      </div>
    </div>
  );
}
