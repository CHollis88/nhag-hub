"use client";

import { CalendarPlus, Share2 } from "lucide-react";
import { useToast } from "./ToastProvider";
import { downloadIcs } from "@/lib/ics";
import { shareText, eventShareText } from "@/lib/share";

// v71.25 -- small "Add to calendar" / "Share" buttons for events, and a
// "Share" button for sermons.
const cls = "inline-flex items-center gap-1.5 text-xs text-accent bg-accent/8 rounded-full px-3 py-1.5";

function report(toast, result) {
  if (result === "copied") toast.success("Copied to your clipboard");
  else if (result === "failed") toast.error("Couldn't share that — try again.");
}

export function EventShareButtons({ event }) {
  const toast = useToast();
  return (
    <div className="flex gap-2 flex-wrap mt-2">
      <button type="button" className={cls} onClick={() => downloadIcs(event)}>
        <CalendarPlus size={12} /> Add to calendar
      </button>
      <button
        type="button"
        className={cls}
        onClick={async () => report(toast, await shareText({ title: event.title, text: eventShareText(event) }))}
      >
        <Share2 size={12} /> Share
      </button>
    </div>
  );
}

export function SermonShareButton({ sermon }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className={cls}
      onClick={async () =>
        report(toast, await shareText({
          title: sermon.title,
          text: [sermon.title, sermon.speaker].filter(Boolean).join(" — "),
          url: sermon.link_url || undefined,
        }))
      }
    >
      <Share2 size={11} /> Share
    </button>
  );
}
