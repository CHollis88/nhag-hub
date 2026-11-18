"use client";

import { useState } from "react";
import { installOrigin } from "@/lib/installDetect";
import { QrCode } from "lucide-react";
import InstallQrCode from "./InstallQrCode";
import { useToast } from "./ToastProvider";

// Admin Toolbox (v71.29): "Help someone install". Show the code, they scan
// it with their phone's camera, and land on the install steps for THEIR
// phone. The same link works in the bulletin, on a slide, or in a text.
export default function InstallHelpCard() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const link = typeof window !== "undefined" ? `${installOrigin()}/install` : "/install";
  return (
    <>
      <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Help someone install</p>
      <div className="sp-card mb-6">
        <p className="text-sm text-inksoft">
          Someone struggling to get the app on their home screen? Have them scan this with their phone&apos;s camera. It opens the steps for their exact phone. You can also share the link in the bulletin, on a slide, or in a text.
        </p>
        {open ? (
          <div className="mt-4">
            <InstallQrCode size={240} />
          </div>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-2 bg-navy text-white rounded-full px-4 py-2 text-sm font-semibold">
            <QrCode size={16} aria-hidden="true" /> Show QR code
          </button>
        )}
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success("Link copied"), () => {})}
          className="mt-3 block text-xs text-accent underline"
        >
          Copy link ({link.replace(/^https?:\/\//, "")})
        </button>
      </div>
    </>
  );
}
