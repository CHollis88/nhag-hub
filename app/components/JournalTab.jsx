"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Check, Download } from "lucide-react";
import { requestJson } from "@/lib/request";
import { readDraft, writeDraft, clearDraft } from "@/lib/journalDrafts";
import { useToast } from "./ToastProvider";

const AUTOSAVE_MS = 2000;

// v71 #13 -- the journal now tells the truth about what's saved.
//
//   * A visible status: "Saving…" -> "Saved", or "Couldn't save" with a
//     Retry. Before, a failed save was swallowed and the entry looked saved.
//   * The text is mirrored to this device on every keystroke (see
//     lib/journalDrafts.js) and only forgotten once the server confirms it.
//   * Switching days (or plans) never throws away what you wrote: the draft
//     for the day you left stays on the device and keeps trying to save.
//   * The parent's `journal` is only updated AFTER the server accepts the
//     entry -- it used to be updated first, so a failure left the app
//     believing something was saved that wasn't.
//   * It saves by itself two seconds after you stop typing, when you leave
//     the box, and on the Save button -- never two at once for the same day.
export default function JournalTab({ plan, activePlanId, dayNum, setDayNum, journal, setJournal, userId }) {
  const [draft, setDraft] = useState("");
  // "idle" | "dirty" | "saving" | "saved" | "error"
  const [status, setStatus] = useState("idle");
  const totalDays = plan.PLAN.length;
  const entry = plan.getDay(dayNum);
  const toast = useToast();

  // Latest values for code that runs later (timers, in-flight saves).
  const journalRef = useRef(journal);
  const viewRef = useRef({ planId: activePlanId, day: dayNum });
  const inflight = useRef(new Map()); // "plan:day" -> { queued: string|null }
  const autosaveTimer = useRef(null);
  const savedTimer = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    journalRef.current = journal;
  });
  useEffect(() => {
    viewRef.current = { planId: activePlanId, day: dayNum };
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(autosaveTimer.current);
      clearTimeout(savedTimer.current);
    };
  }, []);

  // Runs when the DAY or PLAN changes -- deliberately NOT when `journal`
  // changes, which used to reset the box under your cursor after every
  // save. Prefers an unsaved local draft over the server's copy.
  useEffect(() => {
    clearTimeout(autosaveTimer.current);
    const local = readDraft(userId, activePlanId, dayNum);
    const server = journalRef.current[dayNum] || "";
    if (local !== null && local !== server) {
      setDraft(local);
      setStatus("dirty");
    } else {
      if (local !== null) clearDraft(userId, activePlanId, dayNum); // identical to the server copy
      setDraft(server);
      setStatus("idle");
    }
  }, [dayNum, activePlanId, userId]);

  // Saves one specific day's text. Independent of what's on screen, so
  // leaving a day mid-save doesn't cancel or misfile it.
  const saveEntry = async (planId, day, text) => {
    const slot = `${planId}:${day}`;
    const running = inflight.current.get(slot);
    if (running) {
      running.queued = text; // one request at a time per day; latest text wins
      return;
    }
    const state = { queued: null };
    inflight.current.set(slot, state);
    const onScreen = () => viewRef.current.planId === planId && viewRef.current.day === day;
    if (onScreen() && mounted.current) setStatus("saving");

    let ok = false;
    try {
      await requestJson("/api/reading-plan/journal", { method: "POST", body: { day, text, plan_id: planId } });
      ok = true;
    } catch (err) {
      if (mounted.current) toast.error(err.message);
    }

    inflight.current.delete(slot);

    if (ok) {
      // Only now does the app treat this as saved.
      if (viewRef.current.planId === planId) setJournal((prev) => ({ ...prev, [day]: text }));
      // Forget the local copy only if nothing newer has been typed since.
      if (readDraft(userId, planId, day) === text) clearDraft(userId, planId, day);
    }

    if (state.queued !== null && state.queued !== text) {
      return saveEntry(planId, day, state.queued); // text changed while saving
    }
    if (!mounted.current || !onScreen()) return;

    if (ok) {
      setStatus("saved");
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => mounted.current && setStatus((s) => (s === "saved" ? "idle" : s)), 2500);
    } else {
      setStatus("error");
    }
  };

  const onChange = (e) => {
    const text = e.target.value;
    setDraft(text);
    writeDraft(userId, activePlanId, dayNum, text); // on this device immediately
    setStatus("dirty");
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveEntry(activePlanId, dayNum, text);
    }, AUTOSAVE_MS);
  };

  const saveNow = () => {
    clearTimeout(autosaveTimer.current);
    const server = journalRef.current[dayNum] || "";
    // Nothing to send if it already matches what the server has.
    if (draft === server && status !== "error") {
      clearDraft(userId, activePlanId, dayNum);
      setStatus("saved");
      return;
    }
    saveEntry(activePlanId, dayNum, draft);
  };

  // Leaving a day (or the tab) with unsaved text: send it now, in the
  // background, under ITS OWN day. The draft is also on the device either way.
  const flushBeforeLeaving = () => {
    if (status === "dirty" || status === "error") {
      clearTimeout(autosaveTimer.current);
      saveEntry(activePlanId, dayNum, draft);
    }
  };

  useEffect(() => {
    // Component is going away (tab switch / navigation): flush what's dirty.
    return () => {
      const v = viewRef.current;
      const local = readDraft(userId, v.planId, v.day);
      if (local !== null && local !== (journalRef.current[v.day] || "")) {
        // fire-and-forget; the local draft remains if this fails
        requestJson("/api/reading-plan/journal", { method: "POST", body: { day: v.day, text: local, plan_id: v.planId } })
          .then(() => {
            if (readDraft(userId, v.planId, v.day) === local) clearDraft(userId, v.planId, v.day);
          })
          .catch(() => {});
      }
    };
  }, [userId]);

  const go = (delta) => {
    flushBeforeLeaving();
    setDayNum((d) => Math.min(totalDays, Math.max(1, d + delta)));
  };

  const pastEntries = Object.keys(journal)
    .map(Number)
    .filter((d) => journal[d] && journal[d].trim())
    .sort((a, b) => b - a);

  // Client-side only -- no new API call needed, since every entry is
  // already loaded into the journal prop. Downloads only entries the
  // person has actually written, in a plain, readable format.
  const exportJournal = () => {
    const lines = [`My Journal — ${plan.name}`, ""];
    pastEntries
      .slice()
      .sort((a, b) => a - b)
      .forEach((d) => {
        const e = plan.getDay(d);
        lines.push(`Day ${d}${e?.main ? ` — ${e.main}` : ""}`);
        lines.push(journal[d]);
        lines.push("");
      });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `journal-${plan.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-5 pt-4 pb-6">
      <div className="flex items-center justify-between mb-3.5">
        <button onClick={() => go(-1)} disabled={dayNum <= 1} aria-label="Previous day" className="p-2 text-inksoft disabled:opacity-30">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-inkfaint">Journal</p>
          <p className="font-serif text-xl text-ink">Day {dayNum}</p>
        </div>
        <button onClick={() => go(1)} disabled={dayNum >= totalDays} aria-label="Next day" className="p-2 text-inksoft disabled:opacity-30">
          <ChevronRight size={20} />
        </button>
      </div>

      {entry?.type === "reading" && (
        <p className="text-sm text-inkfaint text-center -mt-1.5 mb-3.5">
          {entry.main}
          {entry.gospel ? ` + ${entry.gospel}` : ""}
        </p>
      )}

      <div className="sp-card mb-2.5">
        <textarea
          value={draft}
          onChange={onChange}
          onBlur={flushBeforeLeaving}
          aria-label={`Journal entry for day ${dayNum}`}
          placeholder="What stood out to you today? What is God showing you?"
          rows={5}
          className="sp-textarea min-h-[110px]"
        />
        <div className="flex justify-between items-center mt-2.5 gap-3">
          <span className="text-xs min-w-0" role="status" aria-live="polite">
            {status === "saving" && <span className="text-inkfaint">Saving…</span>}
            {status === "saved" && (
              <span className="text-sage flex items-center gap-1">
                <Check size={13} /> Saved
              </span>
            )}
            {status === "dirty" && <span className="text-inkfaint">Not saved yet</span>}
            {status === "error" && (
              <span className="text-red-600 dark:text-red-400">
                Couldn&apos;t save — your entry is kept on this device. Try again.
              </span>
            )}
          </span>
          <button
            onClick={saveNow}
            disabled={status === "saving"}
            aria-busy={status === "saving" || undefined}
            className="sp-btn-sage py-2 px-4 flex-shrink-0 disabled:opacity-60"
          >
            {status === "saving" ? "Saving…" : status === "error" ? "Retry" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-[0.6875rem] text-inkfaint">Your journal is private — only you can see it.</p>
        {pastEntries.length > 0 && (
          <button onClick={exportJournal} className="text-xs text-accent underline flex items-center gap-1 flex-shrink-0">
            <Download size={12} /> Export
          </button>
        )}
      </div>

      {pastEntries.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-wide text-inkfaint mb-2.5">Past Entries</p>
          <div className="space-y-2">
            {pastEntries.map((d) => {
              const e = plan.getDay(d);
              return (
                <button
                  key={d}
                  onClick={() => setDayNum(d)}
                  className="sp-card text-left w-full"
                >
                  <p className="text-[0.6875rem] text-inkfaint font-semibold mb-1">
                    Day {d}
                    {e && e.main ? ` · ${e.main}` : ""}
                  </p>
                  <p className="text-sm text-ink truncate">{journal[d]}</p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
