"use client";

import { useEffect, useState } from "react";
import InstallGuide from "../components/InstallGuide";
import InstallQrCode from "../components/InstallQrCode";
import { detectDevice, isStandalone } from "@/lib/installDetect";

// nhag.../install (v71.29): the link (or QR code) to put in the bulletin, on
// a slide, or in a text. On a phone it opens the install guide for that
// phone; on a computer it shows a QR code to scan with your phone; in the
// installed app it just says you're all set.
export default function InstallPage() {
  const [mode, setMode] = useState(null); // null | "guide" | "computer" | "installed"
  useEffect(() => {
    if (isStandalone()) setMode("installed");
    else if (detectDevice().mobile) setMode("guide");
    else setMode("computer");
  }, []);

  const goHome = () => {
    window.location.href = "/";
  };

  if (mode === null) return null;
  if (mode === "guide") return <InstallGuide variant="page" onClose={goHome} />;

  return (
    <div className="min-h-[100dvh] bg-paper flex items-center justify-center p-6">
      <div className="sp-card max-w-sm w-full text-center py-8">
        <img src="/icon-192.png" alt="" className="w-16 h-16 rounded-2xl mx-auto mb-4" />
        {mode === "installed" ? (
          <>
            <h1 className="font-serif text-2xl text-ink">You&apos;re all set</h1>
            <p className="text-inksoft mt-2">NHAG is already on your home screen.</p>
          </>
        ) : (
          <>
            <h1 className="font-serif text-2xl text-ink">Get NHAG on your phone</h1>
            <p className="text-inksoft mt-2 mb-5">Point your phone&apos;s camera at this code, then follow the steps it shows.</p>
            <InstallQrCode size={220} />
          </>
        )}
        <button type="button" onClick={goHome} className="mt-6 text-accent underline">
          Open NHAG
        </button>
      </div>
    </div>
  );
}
