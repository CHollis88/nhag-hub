"use client";

import { useEffect, useState } from "react";
import { Lightbulb, X, Download, Smartphone } from "lucide-react";
import InstallQrCode from "./InstallQrCode";
import { detectDevice, isStandalone } from "@/lib/installDetect";
import { canPromptInstall, onInstallPromptChange, promptInstall } from "@/lib/installPrompt";

// Computers (v71.29): the soft version of the install guide. A small "Did
// you know?" card in the corner, a few seconds after the app opens: scan a
// QR code to get NHAG on your phone, and -- where Chrome/Edge allow it --
// install it on this computer too. Closing it keeps it away for 30 days.
// Phones and tablets get the full-screen guide instead (InstallGuide.jsx).

const SNOOZE_KEY = "nhag_desktop_tip_until";
const SNOOZE_DAYS = 30;

export function shouldShowDesktopTip() {
  if (typeof window === "undefined") return false;
  if (isStandalone() || detectDevice().mobile) return false;
  if (window.innerWidth < 768) return false;
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    if (until > Date.now()) return false;
  } catch {
    // ignore
  }
  return true;
}

export default function DesktopInstallTip() {
  const [show, setShow] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    if (!shouldShowDesktopTip()) return undefined;
    const t = setTimeout(() => setShow(true), 4000);
    setCanInstall(canPromptInstall());
    const off = onInstallPromptChange(setCanInstall);
    return () => {
      clearTimeout(t);
      off();
    };
  }, []);

  const close = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86400000));
    } catch {
      // ignore
    }
    setShow(false);
  };

  const install = async () => {
    const r = await promptInstall();
    if (r === "accepted") close();
  };

  if (!show) return null;
  return (
    <div className="hidden md:block fixed bottom-6 right-6 z-40 w-80 sp-card shadow-xl nhag-tip-in" role="complementary" aria-label="Did you know?">
      <button type="button" onClick={close} className="absolute top-2.5 right-2.5 p-1.5 text-inkfaint hover:text-ink" aria-label="Close">
        <X size={16} />
      </button>
      <p className="text-xs uppercase tracking-wide text-accent font-semibold flex items-center gap-1.5 mb-1.5">
        <Lightbulb size={14} aria-hidden="true" /> Did you know?
      </p>
      <p className="text-sm text-ink pr-5">
        NHAG works like an app on your phone: one tap from your home screen, with notifications for church news and events.
      </p>
      {qrOpen ? (
        <div className="mt-3">
          <InstallQrCode size={168} />
          <p className="text-xs text-inksoft text-center mt-1">Point your phone&apos;s camera here, then follow the steps.</p>
        </div>
      ) : (
        <button type="button" onClick={() => setQrOpen(true)} className="mt-3 inline-flex items-center gap-1.5 bg-navy text-white rounded-full px-3.5 py-1.5 text-xs font-semibold">
          <Smartphone size={14} aria-hidden="true" /> Get it on my phone
        </button>
      )}
      {canInstall && (
        <button type="button" onClick={install} className="mt-3 flex items-center gap-1.5 text-xs text-accent font-semibold underline">
          <Download size={13} aria-hidden="true" /> Or install it on this computer
        </button>
      )}
    </div>
  );
}
