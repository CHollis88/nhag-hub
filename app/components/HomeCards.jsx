"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronRight, Clock, Heart, PlayCircle, Share2, Sparkles } from "lucide-react";
import { useResource } from "@/lib/useResource";
import { STALE } from "@/lib/resourceCache";
import { requestJson } from "@/lib/request";
import { HOME_EVENTS } from "@/lib/homeData";
import { todayLocal } from "@/lib/localDate";
import { shareText } from "@/lib/share";
import { hasNewContent } from "@/lib/lastSeen";
import { useToast } from "./ToastProvider";

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

  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Verse of the day</p>
      <div className="sp-card relative overflow-hidden">
        <button
          type="button"
          onClick={() => onOpenPassage?.(verse.book, verse.chapter)}
          className="w-full text-left"
          aria-label={`Verse of the day, ${verse.reference}. Tap to read the chapter.`}
        >
          <p className="font-serif text-[1.0625rem] leading-relaxed text-ink">“{verse.text}”</p>
          <p className="text-xs font-semibold text-accent mt-2 flex items-center gap-1">
            <BookOpen size={12} aria-hidden="true" />
            {verse.reference} · {verse.translation.toUpperCase()}
          </p>
        </button>
        <button
          type="button"
          onClick={share}
          className="absolute bottom-2.5 right-2.5 p-2 text-inkfaint"
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
// This Sunday: the service times an admin types in the Admin Toolbox, and the
// latest sermon. Hidden when neither exists.
export function ThisSundayCard({ onOpenSermons }) {
  const extras = useHomeExtras();
  const times = (extras?.service_times || "").trim();
  const sermon = extras?.latest_sermon || null;
  if (!times && !sermon) return null;

  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">This Sunday</p>
      <div className="sp-card p-0 overflow-hidden divide-y divide-linesoft">
        {times && (
          <div className="flex items-start gap-3 px-3 py-3">
            <Clock size={18} className="text-accent flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-ink whitespace-pre-line leading-relaxed">{times}</p>
          </div>
        )}
        {sermon && (
          <button type="button" onClick={onOpenSermons} className="w-full text-left flex items-center gap-3 px-3 py-3">
            <PlayCircle size={18} className="text-accent flex-shrink-0" aria-hidden="true" />
            <span className="flex-1 min-w-0">
              <span className="block text-[0.6875rem] uppercase tracking-wide text-inkfaint">Latest message</span>
              <span className="block text-sm font-medium text-ink truncate">{sermon.title}</span>
              {(sermon.speaker || sermon.sermon_date) && (
                <span className="block text-xs text-inksoft truncate">
                  {[
                    sermon.speaker,
                    sermon.sermon_date &&
                      new Date(sermon.sermon_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </span>
            <ChevronRight size={16} className="text-inkfaint flex-shrink-0" aria-hidden="true" />
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

// ---------------------------------------------------------------------------
// Welcome: someone who isn't in any ministry yet sees the ministries right at
// the top, with a Request to join button on each.
export function WelcomeCard({ me, groups, pendingGroupIds, onRequestJoin }) {
  const options = (groups || []).filter((g) => !g.hidden && !g.archived_at);
  if (options.length === 0) return null;
  const first = (me?.user?.display_name || "").split(" ")[0];
  return (
    <div className="sp-card mb-6 border-accent/30">
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
