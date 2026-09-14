"use client";

import { useMemo, useState } from "react";
import { Search, Check, Lock } from "lucide-react";
import { PLAN_LIST } from "@/lib/planRegistry";
import EmptyState from "./EmptyState";

export default function PlanTab({ plan, progress, dayNum, setDayNum, setTab, planLocked, onSwitchPlan }) {
  const [query, setQuery] = useState("");
  const [openWeek, setOpenWeek] = useState(plan.PLAN.find((d) => d.day === dayNum)?.week || 1);
  const [switching, setSwitching] = useState(false);

  const weeks = useMemo(() => {
    const map = {};
    plan.PLAN.forEach((d) => {
      if (!map[d.week]) map[d.week] = [];
      map[d.week].push(d);
    });
    return map;
  }, [plan]);

  const filtered = query.trim()
    ? plan.PLAN.filter(
        (d) =>
          d.type === "reading" &&
          ((d.main && d.main.toLowerCase().includes(query.toLowerCase())) ||
            (d.gospel && d.gospel.toLowerCase().includes(query.toLowerCase())))
      )
    : null;

  const jumpToDay = (d) => {
    setDayNum(d);
    setTab("today");
  };

  const isDone = (d) => progress[d]?.p && progress[d]?.r && progress[d]?.m;

  const handleSwitch = async (e) => {
    const newPlanId = e.target.value;
    setSwitching(true);
    await onSwitchPlan(newPlanId);
    setSwitching(false);
  };

  return (
    <div className="px-5 pt-4 pb-6">
      {planLocked ? (
        <div className="sp-card mb-4 flex items-center gap-2.5">
          <Lock size={15} className="text-inkfaint flex-shrink-0" />
          <p className="text-sm text-inksoft">
            This group is following <strong className="text-ink">{plan.name}</strong> together.
          </p>
        </div>
      ) : (
        <div className="sp-card mb-4">
          <label className="block text-xs uppercase tracking-wide text-inkfaint mb-2">Your reading plan</label>
          <select value={plan.id} onChange={handleSwitch} disabled={switching} className="sp-input">
            {PLAN_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.totalDays} days)
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a book..."
          className="sp-input pl-9"
        />
      </div>

      {filtered ? (
        <div className="space-y-1.5">
          {filtered.length === 0 && <EmptyState icon={Search} text="No readings match that search." />}
          {filtered.map((d) => (
            <button
              key={d.day}
              onClick={() => jumpToDay(d.day)}
              className="w-full flex items-center gap-3 bg-card border border-line rounded-lg px-3.5 py-2.5 text-left"
            >
              <span className="text-xs font-semibold text-inkfaint w-9 flex-shrink-0">D{d.day}</span>
              <span className="text-sm text-ink flex-1">
                {d.main}
                {d.gospel && <span className="text-accent"> + {d.gospel}</span>}
              </span>
              {isDone(d.day) && <Check size={15} className="text-sage flex-shrink-0" />}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {Object.keys(weeks)
            .map(Number)
            .sort((a, b) => a - b)
            .map((w) => {
              const items = weeks[w];
              const readingItems = items.filter((d) => d.type === "reading");
              const completed = readingItems.filter((d) => isDone(d.day)).length;
              const open = openWeek === w;
              return (
                <div key={w} className="border border-line rounded-xl overflow-hidden bg-card">
                  <button
                    onClick={() => setOpenWeek(open ? null : w)}
                    className="w-full flex items-center justify-between px-4 py-3"
                  >
                    <span className="font-serif text-base text-ink">Week {w}</span>
                    <span className="text-xs text-inkfaint">
                      {readingItems.length > 0 ? `${completed}/${readingItems.length}` : ""}
                    </span>
                  </button>
                  {open && (
                    <div className="border-t border-linesoft divide-y divide-linesoft">
                      {items.map((d) => (
                        <button
                          key={d.day}
                          onClick={() => jumpToDay(d.day)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                        >
                          <span className="text-xs font-semibold text-inkfaint w-9 flex-shrink-0">{d.day}</span>
                          {d.type === "reading" ? (
                            <span className="text-sm text-ink flex-1">
                              {d.main}
                              {d.gospel && <span className="text-accent"> + {d.gospel}</span>}
                            </span>
                          ) : (
                            <span className="text-sm italic text-inkfaint flex-1">{d.label}</span>
                          )}
                          {d.type === "reading" && isDone(d.day) && (
                            <Check size={15} className="text-sage flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
