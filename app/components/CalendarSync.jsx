"use client";

import { useState } from "react";
import { CalendarDays as SyncIcon, Copy, ExternalLink } from "lucide-react";
import Modal from "./Modal";
import { useToast } from "./ToastProvider";
import { requestJson } from "@/lib/request";

// v71.25 -- "Sync to phone calendar" for the Calendar tab. Gives the person a
// private link their phone's calendar app SUBSCRIBES to, so every church and
// ministry event shows up in their own calendar and stays up to date.
export default function CalendarSync() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState(null);
  const [loading, setLoading] = useState(false);

  const show = async () => {
    setOpen(true);
    if (links) return;
    setLoading(true);
    try {
      setLinks(await requestJson("/api/calendar/link"));
    } catch (err) {
      toast.error(err?.message || "Couldn't get your calendar link.");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(links.https);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — press and hold the link to copy it.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="inline-flex items-center gap-1.5 text-xs text-accent bg-accent/8 rounded-full px-3 py-1.5 mb-3"
      >
        <SyncIcon size={12} /> Sync to phone calendar
      </button>
      {open && (
        <Modal title="Sync to your phone calendar" onClose={() => setOpen(false)}>
          <div className="space-y-3 text-sm text-inksoft">
            <p className="m-0">
              This adds a calendar called “NHAG Church Hub” to your phone with the church-wide events and every ministry
              you're in. Your phone keeps it up to date by itself, usually within a few hours of a change.
            </p>
            {loading || !links ? (
              <p className="m-0 text-inkfaint">Getting your link…</p>
            ) : (
              <>
                <a href={links.webcal} className="sp-btn-primary w-full text-sm flex items-center justify-center gap-2">
                  <ExternalLink size={15} /> Subscribe (iPhone, Mac, Outlook)
                </a>
                <button type="button" onClick={copy} className="sp-btn-secondary w-full text-sm flex items-center justify-center gap-2">
                  <Copy size={15} /> Copy link (Google Calendar / Android)
                </button>
                <p className="m-0 text-xs text-inkfaint">
                  <strong>Android / Google Calendar:</strong> copy the link, then on a computer open Google Calendar →
                  Other calendars → <em>+</em> → From URL, and paste it. It then shows on your phone. (The Google Calendar
                  app can't add it directly.)
                </p>
                <p className="m-0 text-xs text-inkfaint">
                  This link is private to you. Don't share it. It only ever shows events you can already see in the app.
                </p>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
