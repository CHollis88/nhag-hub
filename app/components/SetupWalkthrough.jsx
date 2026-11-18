"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Users, BookOpen, Camera, PartyPopper, Check } from "lucide-react";
import ProfilePhoto from "./ProfilePhoto";
import { BibleChoices } from "./BiblePickerSheet";
import { useToast } from "./ToastProvider";
import { requestJson } from "@/lib/request";
import { useResource } from "@/lib/useResource";
import { HOME_GROUPS } from "@/lib/homeData";
import { subscribeToPush, isSubscribedToPush } from "@/lib/pushClient";
import { detectDevice, isStandalone } from "@/lib/installDetect";
import { checklistItems, declineItem, finishWalkthrough } from "@/lib/onboarding";

// v72: the first-time setup walkthrough for NEW accounts, right after
// sign-up. One task per screen: photo, notifications, ministries, Bible.
// Every screen has "Skip for now" (it waits in the Home checklist) and
// "No thanks" (gone for good -- some people won't want a photo, and that's
// fine). Only the tasks they haven't done or turned down are shown.

const STEP_ORDER = ["photo", "notifications", "ministry", "bible"];

export default function SetupWalkthrough({ me, refreshMe, onClose, onOpenInstall }) {
  const toast = useToast();
  // Fix the step list when the walkthrough opens, so finishing a step
  // doesn't make the list jump around underneath them.
  const steps = useMemo(() => {
    const open = new Set(checklistItems(me).filter((i) => !i.done).map((i) => i.id));
    return STEP_ORDER.filter((id) => open.has(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [index, setIndex] = useState(0);
  const step = steps[index];

  useEffect(() => {
    if (steps.length === 0) {
      finishWalkthrough();
      onClose?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = () => {
    if (index + 1 >= steps.length) setIndex(steps.length); // "all set" screen
    else setIndex(index + 1);
  };
  const noThanks = () => {
    declineItem(step);
    next();
  };
  const finish = () => {
    finishWalkthrough();
    onClose?.();
  };

  if (steps.length === 0) return null;
  const allSet = index >= steps.length;

  return (
    <div className="fixed inset-0 z-[74] bg-paper overflow-y-auto" role="dialog" aria-modal="true" aria-label="Set up NHAG">
      <div className="max-w-md mx-auto px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-10 min-h-full flex flex-col">
        {!allSet && (
          <div className="flex items-center gap-1.5 mb-6" aria-label={`Step ${index + 1} of ${steps.length}`}>
            {steps.map((s, i) => (
              <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= index ? "bg-accent" : "bg-line"}`} />
            ))}
          </div>
        )}

        <div className="flex-1">
          {allSet ? (
            <Done onFinish={finish} />
          ) : step === "photo" ? (
            <Step icon={Camera} title="Add a profile photo" body="It shows next to your name in your ministries, the Directory, and on what you post, so people know who's who.">
              <div className="flex justify-center mt-2">
                <ProfilePhoto me={me} refreshMe={refreshMe} big onUploaded={() => setTimeout(next, 700)} />
              </div>
            </Step>
          ) : step === "notifications" ? (
            <NotificationsStep onDone={next} onOpenInstall={onOpenInstall} toast={toast} />
          ) : step === "ministry" ? (
            <MinistryStep me={me} refreshMe={refreshMe} toast={toast} />
          ) : step === "bible" ? (
            <Step icon={BookOpen} title="Pick your Bible" body="The translation the Bible tab opens in. You can switch any time.">
              <BibleChoices onPicked={() => setTimeout(next, 400)} />
            </Step>
          ) : null}
        </div>

        {!allSet && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <button type="button" onClick={next} className="w-full bg-navy text-white rounded-xl py-3.5 text-base font-semibold">
              {step === "ministry" ? "Next" : "Skip for now"}
            </button>
            <button type="button" onClick={noThanks} className="text-sm text-inkfaint underline">
              No thanks, don&apos;t ask me again
            </button>
            <button type="button" onClick={finish} className="text-xs text-inkfaint mt-2">
              I&apos;ll finish later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({ icon: I, title, body, children }) {
  return (
    <div>
      <span className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-4">
        <I size={28} aria-hidden="true" />
      </span>
      <h1 className="font-serif text-2xl text-ink leading-tight">{title}</h1>
      <p className="text-base text-inksoft mt-2 mb-6">{body}</p>
      {children}
    </div>
  );
}

function NotificationsStep({ onDone, onOpenInstall, toast }) {
  const device = useMemo(() => detectDevice(), []);
  const needsInstall = device.os === "ios" && !isStandalone();
  const [busy, setBusy] = useState(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    isSubscribedToPush().then(setOn);
  }, []);

  const turnOn = async () => {
    setBusy(true);
    const r = await subscribeToPush();
    setBusy(false);
    if (r.ok) {
      setOn(true);
      toast.success("Notifications on");
      setTimeout(onDone, 700);
    } else if (r.reason === "denied") {
      toast.error("Notifications are blocked. You can allow them later in your phone's settings.");
    } else {
      toast.error("This phone can't turn on notifications here yet.");
    }
  };

  return (
    <Step icon={Bell} title="Turn on notifications" body="Hear about church news, events, sermons, and what's happening in your ministries. You choose what you get in Settings.">
      {on ? (
        <p className="text-base text-green-700 dark:text-green-400 flex items-center gap-2"><Check size={18} /> They&apos;re on.</p>
      ) : needsInstall ? (
        <>
          <p className="text-base text-ink mb-4">On iPhone, notifications work once NHAG is on your home screen.</p>
          <button type="button" onClick={onOpenInstall} className="w-full bg-accent text-white rounded-xl py-3.5 text-lg font-semibold">
            Show me how
          </button>
        </>
      ) : (
        <button type="button" onClick={turnOn} disabled={busy} className="w-full bg-accent text-white rounded-xl py-3.5 text-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-70">
          <Bell size={20} aria-hidden="true" /> {busy ? "Asking…" : "Turn on notifications"}
        </button>
      )}
    </Step>
  );
}

function MinistryStep({ me, refreshMe, toast }) {
  const { data: groups } = useResource(HOME_GROUPS.key, HOME_GROUPS.fetcher, { staleMs: HOME_GROUPS.staleMs });
  const mine = new Set((me.memberships || []).map((m) => m.group_id));
  const pending = new Set((me.memberships || []).filter((m) => m.status === "pending").map((m) => m.group_id));
  const [asked, setAsked] = useState(() => new Set());
  const options = (groups || []).filter((g) => !g.hidden && !g.archived_at);

  const join = async (g) => {
    setAsked((s) => new Set(s).add(g.id));
    try {
      await requestJson(`/api/groups/${g.id}/join-request`, { method: "POST" });
      toast.success(`Request sent to join ${g.name}. A leader will review it.`);
      refreshMe?.();
    } catch (err) {
      setAsked((s) => {
        const n = new Set(s);
        n.delete(g.id);
        return n;
      });
      toast.error(err.message);
    }
  };

  return (
    <Step icon={Users} title="Join your ministries" body="Ask to join any you're part of. A leader approves it, then it shows up on your Home screen.">
      {groups === undefined || groups === null ? (
        <p className="text-sm text-inkfaint">Loading ministries…</p>
      ) : options.length === 0 ? (
        <p className="text-sm text-inksoft">There aren&apos;t any ministries to join yet.</p>
      ) : (
        <div className="space-y-2">
          {options.map((g) => {
            const state = mine.has(g.id) && !pending.has(g.id) ? "member" : pending.has(g.id) || asked.has(g.id) ? "pending" : "none";
            return (
              <div key={g.id} className="sp-card flex items-center gap-3 py-3">
                {g.image_url ? (
                  <img src={g.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <span className="w-10 h-10 rounded-lg bg-navy text-white flex items-center justify-center font-serif flex-shrink-0">{g.name?.[0]}</span>
                )}
                <span className="flex-1 min-w-0 font-medium text-ink truncate">{g.name}</span>
                {state === "member" ? (
                  <span className="text-xs text-green-700 dark:text-green-400 font-semibold">Joined</span>
                ) : state === "pending" ? (
                  <span className="text-xs text-inkfaint">Requested</span>
                ) : (
                  <button type="button" onClick={() => join(g)} className="bg-accent text-white rounded-full px-3.5 py-1.5 text-xs font-semibold">
                    Request to join
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Step>
  );
}

function Done({ onFinish }) {
  return (
    <div className="text-center pt-16">
      <span className="mx-auto w-16 h-16 rounded-full bg-accent/10 text-accent flex items-center justify-center mb-4">
        <PartyPopper size={32} aria-hidden="true" />
      </span>
      <h1 className="font-serif text-3xl text-ink">You&apos;re all set</h1>
      <p className="text-base text-inksoft mt-2">Anything you skipped is waiting on your Home screen under “Finish setting up.”</p>
      <button type="button" onClick={onFinish} className="mt-8 w-full bg-accent text-white rounded-xl py-3.5 text-lg font-semibold">
        Go to Home
      </button>
    </div>
  );
}
