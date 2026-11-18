"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronRight, Clock, Heart, Share2, Sparkles } from "lucide-react";
import { useResource } from "@/lib/useResource";
import { STALE } from "@/lib/resourceCache";
import { requestJson } from "@/lib/request";
import { HOME_EVENTS } from "@/lib/homeData";
import { todayLocal } from "@/lib/localDate";
import { shareText } from "@/lib/share";
import { hasNewContent } from "@/lib/lastSeen";
import { useToast } from "./ToastProvider";
import { formatTime12h } from "@/lib/formatTime";
import NewPill from "./NewPill";
import { markFeatureSeen } from "@/lib/newFeatures";

// Home's extra cards (v71.29). The Church prayer and This Sunday cards read
// the events request Home already makes (/api/events/mine?include=news,home),
// so they cost no extra calls; Verse of the Day is one request a day that the
// phone and Vercel's edge both keep for the whole day.

function useHomeExtras() {
  const { data } = useResource(HOME_EVENTS.key, HOME_EVENTS.fetcher, { staleMs: HOME_EVENTS.staleMs });
  return data;
}

// ---------------------------------------------------------------------------
// Verse of the Day. KJV or BSB (both stored in the app), matching the
// translation you read in; ESV/NLT readers see BSB, labelled as such.
export function VerseOfDayCard({ onOpenPassage }) {
  const toast = useToast();
  // Home only ever renders in the browser (after sign-in), so reading the
  // saved translation straight away is safe and avoids a second request.
  const [translation] = useState(() => {
    try {
      const pref = localStorage.getItem("sp_bible_translation");
      return !pref || pref === "kjv" ? "kjv" : "bsb";
    } catch {
      return "kjv";
    }
  });
  const date = todayLocal();
  const { data: verse } = useResource(
    `verse-of-day:${date}:${translation}`,
    () => requestJson(`/api/bible/verse-of-day?date=${date}&translation=${translation}`),
    { staleMs: STALE.static }
  );
  if (!verse) return null;

  const share = async (e) => {
    e.stopPropagation();
    const result = await shareText({ title: verse.reference, text: `"${verse.text}" — ${verse.reference} (${verse.translation.toUpperCase()})` });
    if (result === "copied") toast.success("Verse copied");
  };

  // Compact (v71.29): the label sits inside the card and long verses stop at
  // three lines -- the whole verse is one tap away in the reader.
  return (
    <div className="mb-4">
      <div className="sp-card relative overflow-hidden py-3">
        <button
          type="button"
          onClick={() => onOpenPassage?.(verse.book, verse.chapter)}
          className="w-full text-left pr-8"
          aria-label={`Verse of the day, ${verse.reference}. Tap to read the chapter.`}
        >
          <p className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-1">Verse of the day</p>
          <p className="font-serif text-[0.9375rem] leading-snug text-ink line-clamp-3">“{verse.text}”</p>
          <p className="text-xs font-semibold text-accent mt-1.5 flex items-center gap-1">
            <BookOpen size={12} aria-hidden="true" />
            {verse.reference} · {verse.translation.toUpperCase()}
          </p>
        </button>
        <button
          type="button"
          onClick={share}
          className="absolute top-1.5 right-1.5 p-2 text-inkfaint"
          aria-label="Share this verse"
          title="Share"
        >
          <Share2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// This Sunday + your next event, side by side in one compact card (v71.29).
// Either half takes the full width when the other has nothing to show.
export function ThisSundayCard({ nextEvent = null, onOpenEvents }) {
  const extras = useHomeExtras();
  const times = (extras?.service_times || "").trim();
  if (!times && !nextEvent) return null;

  return (
    <div className="mb-4">
      <div className="sp-card p-0 overflow-hidden flex divide-x divide-linesoft">
        {times && (
          <div className={`px-3 py-2.5 min-w-0 ${nextEvent ? "w-[57%] flex-shrink-0" : "flex-1"}`}>
            <p className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-0.5 flex items-center gap-1">
              <Clock size={11} className="text-accent flex-shrink-0" aria-hidden="true" /> This Sunday
            </p>
            <p className="text-[0.8125rem] text-ink whitespace-pre-line leading-snug">{times}</p>
          </div>
        )}
        {nextEvent && (
          <button
            type="button"
            onClick={onOpenEvents}
            className="text-left px-3 py-2.5 min-w-0 flex items-start gap-1 flex-1"
            aria-label={`Your next event: ${nextEvent.title}. Open the calendar.`}
          >
            <span className="flex-1 min-w-0">
              <span className="text-[0.6875rem] uppercase tracking-wide text-inkfaint mb-0.5 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: nextEvent.color }} aria-hidden="true" />
                <span className="truncate">Next event</span>
              </span>
              <span className="block text-[0.8125rem] font-medium text-ink leading-snug line-clamp-2">{nextEvent.title}</span>
              <span className="block text-xs text-inksoft truncate">
                {new Date(nextEvent.event_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                {nextEvent.event_time && ` · ${formatTime12h(nextEvent.event_time)}`}
              </span>
              <span className="block text-[0.625rem] text-inkfaint truncate">{nextEvent.sourceName}</span>
            </span>
            <ChevronRight size={14} className="text-inkfaint flex-shrink-0 mt-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Church prayer: how many requests are open, the newest one, and a "new" dot
// when something was added since you last opened it. Hidden while an admin has
// church prayer switched off.
export const CHURCH_PRAYER_SEEN = "church-prayer";

export function ChurchPrayerCard({ onOpen }) {
  const extras = useHomeExtras();
  const cp = extras?.church_prayer;
  // Read "new" after mount (it uses this phone's saved last-seen time).
  const [isNew, setIsNew] = useState(false);
  useEffect(() => {
    setIsNew(Boolean(cp?.latest?.created_at) && hasNewContent(CHURCH_PRAYER_SEEN, cp.latest.created_at));
  }, [cp?.latest?.created_at]);
  if (!cp?.enabled) return null;

  const count = cp.open_count || 0;
  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Church prayer</p>
      <button type="button" onClick={onOpen} className="sp-card w-full text-left flex items-center gap-3">
        <span className="relative w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
          <Heart size={18} aria-hidden="true" />
          {isNew && (
            <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-accent border-2 border-card" aria-label="New requests" />
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-ink">
            {count === 0 ? "Share a prayer request" : `${count} ${count === 1 ? "request" : "requests"} to pray for`}
          </span>
          <span className="block text-xs text-inksoft line-clamp-1 break-words">
            {cp.latest ? cp.latest.body : "Ask the church to pray with you."}
          </span>
        </span>
        <ChevronRight size={16} className="text-inkfaint flex-shrink-0" aria-hidden="true" />
      </button>
    </div>
  );
}

// Church Prayer as a tile among "Your ministries" (v71.29): opens the prayer
// page like a ministry tile opens a ministry. Red dot = new since you last
// looked. Hidden while an admin has church prayer switched off.
export function ChurchPrayerTile({ onOpen }) {
  const extras = useHomeExtras();
  const cp = extras?.church_prayer;
  const [isNew, setIsNew] = useState(false);
  useEffect(() => {
    setIsNew(Boolean(cp?.latest?.created_at) && hasNewContent(CHURCH_PRAYER_SEEN, cp.latest.created_at));
  }, [cp?.latest?.created_at]);
  if (!cp?.enabled) return null;
  const count = cp.open_count || 0;

  return (
    <button
      type="button"
      onClick={() => {
        markFeatureSeen("church-prayer");
        onOpen?.();
      }}
      aria-label={`Open Church Prayer${count ? `, ${count} ${count === 1 ? "request" : "requests"}` : ""}${isNew ? ", new requests" : ""}`}
      className="sp-card p-0 overflow-hidden flex flex-col h-full w-full text-left"
    >
      <div className="h-1 flex-shrink-0 w-full bg-accent" />
      <div className="px-2 py-2.5 md:p-4 flex flex-col items-center text-center flex-1 w-full">
        <span className="relative w-11 h-11 md:w-14 md:h-14 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0 mb-1.5">
          <Heart size={22} aria-hidden="true" />
          {isNew && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent border-2 border-card" aria-hidden="true" />}
        </span>
        <span className="font-serif text-sm md:text-lg text-ink leading-snug break-words">Church Prayer</span>
        <NewPill id="church-prayer" className="mt-1" />
        <span className="text-[0.625rem] md:text-xs text-inkfaint mt-0.5">
          {count === 0 ? "Share a request" : `${count} ${count === 1 ? "request" : "requests"}`}
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Welcome: someone who isn't in any ministry yet sees the ministries right at
// the top, with a Request to join button on each.
export function WelcomeCard({ me, groups, pendingGroupIds, onRequestJoin }) {
  const options = (groups || []).filter((g) => !g.hidden && !g.archived_at);
  if (options.length === 0) return null;
  const first = (me?.user?.display_name || "").split(" ")[0];
  return (
    <div id="welcome-card" className="sp-card mb-6 border-accent/30">
      <p className="font-serif text-xl text-ink flex items-center gap-2">
        <Sparkles size={18} className="text-accent" aria-hidden="true" />
        Welcome{first ? `, ${first}` : ""}!
      </p>
      <p className="text-sm text-inksoft mt-1 mb-3">
        Which ministries are you part of? Ask to join, and a leader will add you. You can always join more later from Home.
      </p>
      <div className="space-y-1.5">
        {options.map((g) => (
          <div key={g.id} className="flex items-center gap-3 py-1">
            {g.image_url ? (
              <img src={g.image_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <span className="w-9 h-9 rounded-lg flex-shrink-0 bg-line" aria-hidden="true" />
            )}
            <span className="flex-1 min-w-0 text-sm text-ink truncate">{g.name}</span>
            {pendingGroupIds.has(g.id) ? (
              <span className="text-[0.6875rem] font-medium text-inksoft bg-line/40 rounded-full px-2.5 py-1">Requested</span>
            ) : (
              <button
                type="button"
                onClick={() => onRequestJoin(g.id, g.name)}
                className="sp-btn-secondary text-xs px-3 min-h-[40px]"
                aria-label={`Request to join ${g.name}`}
              >
                Request to join
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
