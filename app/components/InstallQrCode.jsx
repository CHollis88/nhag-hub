"use client";

import { useEffect, useState } from "react";
import { installOrigin } from "@/lib/installDetect";

// A QR code for this site's /install page (v71.29). Drawn on the phone; the
// QR library is only downloaded when a code is actually shown.
export default function InstallQrCode({ size = 200 }) {
  const [svg, setSvg] = useState("");
  const url = typeof window !== "undefined" ? `${installOrigin()}/install` : "";
  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((QR) => QR.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0B1A3D", light: "#FFFFFF" } }))
      .then((s) => alive && setSvg(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <div className="flex flex-col items-center">
      <div
        className="bg-white rounded-xl p-2 border border-line [&>svg]:w-full [&>svg]:h-full"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`QR code for ${url}`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-xs text-inkfaint mt-2 break-all">{url.replace(/^https?:\/\//, "")}</p>
    </div>
  );
}
