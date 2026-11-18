"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Share,
  Ellipsis,
  EllipsisVertical,
  SquarePlus,
  Download,
  Copy,
  ExternalLink,
  ArrowDown,
  ArrowUp,
  Check,
  Menu,
  Smartphone,
} from "lucide-react";
import { detectDevice, openInBrowserUrl, INSTALL_DISMISSED_KEY, INSTALL_LATER_KEY } from "@/lib/installDetect";
import { canPromptInstall, onInstallPromptChange, promptInstall } from "@/lib/installPrompt";

// "Install NHAG on your Home Screen" (v71.29). A full screen that shows ONLY
// the steps for this person's phone and browser, one numbered line at a
// time, in big type. See lib/installDetect.js for how the phone/browser is
// worked out.
//
// iPhone: no website can install itself -- Apple requires the person to do
// it from the browser's Share menu -- so the steps point at exactly where to
// tap (iOS 26's "..." menu vs. the older Share button, Safari vs. Chrome).
// Android: a real one-tap Install button whenever Chrome offers it.
// Apps' built-in browsers (Facebook, Messenger, ...): step one is a button
// that jumps to Safari/Chrome, because those can't install anything.

const Icon = ({ as: I, label }) => (
  <span className="inline-flex items-center justify-center align-middle mx-0.5 w-7 h-7 rounded-md bg-[#eef1fa] text-[#16296B] border border-[#d5dbef]" aria-label={label} role="img">
    <I size={17} strokeWidth={2.2} aria-hidden="true" />
  </span>
);

function plan(d, androidCanPrompt) {
  const ios = d.os === "ios";
  const browserName = ios ? "Safari" : "Chrome";

  // In an app's built-in browser (Facebook, Messenger, Gmail...).
  const needsRealBrowser =
    d.browser === "inapp" ||
    (d.os === "android" && !["chrome", "samsung"].includes(d.browser)) ||
    (ios && d.browser !== "safari" && !(d.browser === "chrome" && (d.iosMajor > 16 || (d.iosMajor === 16 && d.iosMinor >= 4))));
  if (needsRealBrowser) {
    const where = d.browser === "inapp" ? `inside ${d.inAppName || "another app"}` : "in this browser";
    return {
      kind: "open",
      browserName,
      intro: `You're ${where}. Adding to your home screen only works in ${browserName}.`,
      arrow: null,
    };
  }

  if (d.os === "android") {
    if (androidCanPrompt) return { kind: "prompt", intro: "One tap and it's on your home screen.", arrow: null };
    if (d.browser === "samsung") {
      return {
        kind: "steps",
        intro: "In Samsung Internet:",
        arrow: "down-right",
        steps: [
          <>Tap the menu <Icon as={Menu} label="menu" /> at the bottom right.</>,
          <>Tap <b>“Add page to”</b>, then <b>“Home screen”</b>.</>,
          <>Tap <b>Add</b>.</>,
        ],
        tip: <>See a <Icon as={Download} label="install" /> icon in the address bar? Tapping it works too.</>,
      };
    }
    return {
      kind: "steps",
      intro: "In Chrome:",
      arrow: "up-right",
      steps: [
        <>Tap the menu <Icon as={EllipsisVertical} label="three dots" /> at the top right.</>,
        <>Tap <b>“Add to Home screen”</b> or <b>“Install app”</b>.</>,
        <>Tap <b>Install</b> (or <b>Add</b>).</>,
      ],
    };
  }

  // iPhone / iPad
  if (d.browser === "chrome") {
    return {
      kind: "steps",
      intro: "In Chrome on iPhone:",
      arrow: "up-right",
      steps: [
        <>Tap Share <Icon as={Share} label="share" /> in the address bar at the top.</>,
        <>Tap <b>“Add to Home Screen”</b> <Icon as={SquarePlus} label="add to home screen" /> (you may need to tap <b>More</b> or scroll).</>,
        <>Tap <b>Add</b>.</>,
      ],
    };
  }
  if ((d.safariMajor || 0) >= 26) {
    return {
      kind: "steps",
      intro: d.iPad ? "In Safari on iPad:" : "In Safari:",
      arrow: d.iPad ? "up-right" : "down-right",
      steps: [
        <>Tap <Icon as={Ellipsis} label="three dots" /> next to the address bar.</>,
        <>Tap <b>Share</b> <Icon as={Share} label="share" />.</>,
        <>Scroll down and tap <b>“Add to Home Screen”</b> <Icon as={SquarePlus} label="add to home screen" />.</>,
        <>Make sure <b>“Open as Web App”</b> is on, then tap <b>Add</b>.</>,
      ],
      tip: <>Don&apos;t see <Icon as={Ellipsis} label="three dots" />? Tap the Share icon <Icon as={Share} label="share" /> instead and skip to step 3.</>,
    };
  }
  return {
    kind: "steps",
    intro: d.iPad ? "In Safari on iPad:" : "In Safari:",
    arrow: d.iPad ? "up-right" : "down",
    steps: [
      <>Tap Share <Icon as={Share} label="share" /> {d.iPad ? "at the top right" : "at the bottom of the screen"}.</>,
      <>Scroll down and tap <b>“Add to Home Screen”</b> <Icon as={SquarePlus} label="add to home screen" />.</>,
      <>Tap <b>Add</b> at the top right.</>,
    ],
  };
}

function PointingArrow({ dir }) {
  if (!dir) return null;
  const pos = {
    down: "bottom-3 left-1/2 -translate-x-1/2",
    "down-right": "bottom-3 right-5",
    "up-right": "top-3 right-5",
  }[dir];
  const A = dir.startsWith("up") ? ArrowUp : ArrowDown;
  return (
    <div className={`fixed ${pos} z-[76] pointer-events-none nhag-install-arrow`} aria-hidden="true">
      <span className="flex items-center justify-center w-12 h-12 rounded-full bg-accent text-white shadow-lg">
        <A size={26} strokeWidth={2.6} />
      </span>
    </div>
  );
}

export default function InstallGuide({ onClose, variant = "auto" }) {
  const device = useMemo(() => detectDevice(), []);
  const [canPrompt, setCanPrompt] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | installing | installed | opened | copied
  useEffect(() => {
    setCanPrompt(canPromptInstall());
    return onInstallPromptChange(setCanPrompt);
  }, []);
  const p = plan(device, canPrompt);

  const close = (reason) => {
    try {
      if (reason === "have-it") localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
      // "New here?" stores nothing: the guide comes back right after their
      // account is set up, which is the right moment on iPhone.
      if (reason === "later") sessionStorage.setItem(INSTALL_LATER_KEY, "1");
    } catch {
      // ignore
    }
    onClose?.(reason);
  };

  const install = async () => {
    setStatus("installing");
    const r = await promptInstall();
    if (r === "accepted") {
      setStatus("installed");
      try {
        localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
      } catch {
        // ignore
      }
    } else setStatus("idle");
  };

  const openBrowser = () => {
    const url = openInBrowserUrl(device);
    setStatus("opened");
    window.location.href = url;
  };

  const copyLink = async () => {
    const href = window.location.origin + "/";
    try {
      await navigator.clipboard.writeText(href);
    } catch {
      window.prompt("Copy this link:", href);
    }
    setStatus("copied");
  };

  return (
    <div className="fixed inset-0 z-[75] bg-paper overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <div className="nhag-welcome text-white px-6 pt-[calc(env(safe-area-inset-top)+1.75rem)] pb-6 text-center">
        <img src="/icon-192.png" alt="" className="w-16 h-16 rounded-2xl mx-auto mb-3 shadow-lg" />
        <h1 id="install-title" className="font-serif text-2xl leading-tight">Install NHAG on your Home Screen</h1>
        <p className="text-sm text-[#c9d2ee] mt-2">
          Free, and about 30 seconds. You&apos;ll open it like any other app and get church notifications.
        </p>
      </div>

      <div className="px-5 py-6 max-w-md mx-auto">
        {status === "installed" ? (
          <div className="sp-card text-center py-8">
            <span className="mx-auto mb-3 w-14 h-14 rounded-full bg-green-600 text-white flex items-center justify-center">
              <Check size={30} strokeWidth={3} />
            </span>
            <p className="font-serif text-2xl text-ink">Installed!</p>
            <p className="text-base text-inksoft mt-2">
              Close this and open <b>NHAG</b> from your home screen.
            </p>
            <button type="button" onClick={() => close("have-it")} className="mt-6 w-full bg-accent text-white rounded-xl py-3.5 text-lg font-semibold">
              Done
            </button>
          </div>
        ) : p.kind === "prompt" ? (
          <div className="sp-card text-center py-7">
            <p className="text-lg text-ink mb-5">{p.intro}</p>
            <button
              type="button"
              onClick={install}
              disabled={status === "installing"}
              className="w-full bg-accent text-white rounded-xl py-4 text-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <Download size={24} aria-hidden="true" /> {status === "installing" ? "Installing…" : "Install NHAG"}
            </button>
            <p className="text-sm text-inkfaint mt-4">Then tap <b>Install</b> on the box that pops up.</p>
          </div>
        ) : p.kind === "open" ? (
          <div className="sp-card py-6">
            <p className="text-lg text-ink text-center">{p.intro}</p>
            <button
              type="button"
              onClick={openBrowser}
              className="mt-5 w-full bg-accent text-white rounded-xl py-4 text-xl font-semibold flex items-center justify-center gap-2"
            >
              <ExternalLink size={22} aria-hidden="true" /> Open in {p.browserName}
            </button>
            <p className="text-sm text-inksoft text-center mt-3">This page will open there with the steps to finish.</p>

            {(status === "opened" || status === "copied") && (
              <div className="mt-6 border-t border-linesoft pt-5">
                <p className="text-base font-semibold text-ink mb-3">Didn&apos;t open? Do this instead:</p>
                <ol className="space-y-3 text-base text-ink">
                  <li className="flex gap-3">
                    <span className="nhag-step">1</span>
                    <span>
                      <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 bg-navy text-white rounded-lg px-3 py-1.5 text-sm font-semibold">
                        <Copy size={15} aria-hidden="true" /> {status === "copied" ? "Link copied ✓" : "Copy the link"}
                      </button>
                    </span>
                  </li>
                  <li className="flex gap-3"><span className="nhag-step">2</span><span>Open the <b>{p.browserName}</b> app.</span></li>
                  <li className="flex gap-3"><span className="nhag-step">3</span><span>Tap the address bar, press and hold, and tap <b>Paste and Go</b>.</span></li>
                </ol>
                {device.browser === "inapp" && (
                  <p className="text-sm text-inkfaint mt-4">
                    Or look for <Icon as={device.os === "ios" ? Ellipsis : EllipsisVertical} label="menu" /> in a corner of this screen and choose <b>“Open in {p.browserName}”</b> or <b>“Open in browser”</b>.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="sp-card py-5">
            <p className="text-base font-semibold text-inksoft mb-4">{p.intro}</p>
            <ol className="space-y-5">
              {p.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-lg leading-snug text-ink">
                  <span className="nhag-step">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
              <li className="flex gap-3 text-lg leading-snug text-ink">
                <span className="nhag-step bg-green-600"><Check size={18} strokeWidth={3} /></span>
                <span className="pt-0.5">Open <b>NHAG</b> from your home screen. That&apos;s it!</span>
              </li>
            </ol>
            {p.tip && <p className="text-sm text-inksoft mt-5 bg-[#f6f7fb] dark:bg-white/5 rounded-lg px-3 py-2.5">{p.tip}</p>}
            {device.os === "ios" && (
              <p className="text-sm text-inksoft mt-3 bg-[#f6f7fb] dark:bg-white/5 rounded-lg px-3 py-2.5">
                <b>Can&apos;t find “Add to Home Screen”?</b> Scroll all the way down. Extra-large text can push it off the menu: turn the text size down for a moment (<b>Settings → Display &amp; Brightness → Text Size</b>), add the app, then turn it back up.
              </p>
            )}
          </div>
        )}

        {status !== "installed" && (
          <div className={`mt-6 flex flex-col items-center gap-3 ${p.kind === "steps" && String(p.arrow).startsWith("down") ? "pb-28" : "pb-16"}`}>
            {variant === "signin" && (
              <button type="button" onClick={() => close("new")} className="text-base text-accent underline font-medium">
                New here? Set up your account first
              </button>
            )}
            <button type="button" onClick={() => close("have-it")} className="w-full border border-line rounded-xl py-3 text-base text-ink font-medium bg-card">
              <Smartphone size={17} className="inline -mt-0.5 mr-1.5" aria-hidden="true" />
              I already have it on my home screen
            </button>
            <button type="button" onClick={() => close("later")} className="text-sm text-inkfaint underline py-1">
              Not now
            </button>
          </div>
        )}
      </div>

      {p.kind === "steps" && status === "idle" && <PointingArrow dir={p.arrow} />}
    </div>
  );
}
