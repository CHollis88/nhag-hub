"use client";

import { useEffect, useState, useCallback } from "react";
import TodayTab from "./TodayTab";
import PlanTab from "./PlanTab";
import JournalTab from "./JournalTab";

const SUBTABS = [
  { key: "today", label: "Today" },
  { key: "plan", label: "Plan" },
  { key: "journal", label: "Journal" },
];

// Mounted inside a group's shell when that group has the
// 'reading_plan_journal' feature turned on (e.g. a Young Adults-style
// group). Ported from the Young Adults app's Today/Plan/Journal trio --
// progress and journal entries are personal to the signed-in user (see
// migration_006_reading_plan_journal.sql), not stored per-group, since
// they belong to the person regardless of which group's nav exposes them.
export default function ReadingPlanTab({ onOpenBiblePassage }) {
  const [subtab, setSubtab] = useState("today");
  const [dayNum, setDayNum] = useState(1);
  const [progress, setProgress] = useState({});
  const [journal, setJournal] = useState({});
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [p, j] = await Promise.all([
      fetch("/api/reading-plan/progress").then((r) => r.json()),
      fetch("/api/reading-plan/journal").then((r) => r.json()),
    ]);
    setProgress(p.progress || {});
    setJournal(j.journal || {});
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!loaded) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, padding: "16px 16px 0" }}>
        {SUBTABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubtab(t.key)}
            style={{
              fontSize: 13,
              fontWeight: subtab === t.key ? 700 : 400,
              padding: "6px 14px",
              borderRadius: 999,
              border: subtab === t.key ? "1px solid #16296B" : "1px solid #ccc",
              background: subtab === t.key ? "#16296B" : "#fff",
              color: subtab === t.key ? "#fff" : "#333",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subtab === "today" && (
        <TodayTab
          progress={progress}
          setProgress={setProgress}
          dayNum={dayNum}
          setDayNum={setDayNum}
          setTab={setSubtab}
          onOpenBiblePassage={onOpenBiblePassage}
        />
      )}
      {subtab === "plan" && (
        <PlanTab progress={progress} dayNum={dayNum} setDayNum={setDayNum} setTab={setSubtab} />
      )}
      {subtab === "journal" && (
        <JournalTab dayNum={dayNum} setDayNum={setDayNum} journal={journal} setJournal={setJournal} />
      )}
    </div>
  );
}
