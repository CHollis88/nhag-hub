"use client";

import { useEffect, useState } from "react";
import { isNewFeature } from "@/lib/newFeatures";

/** A small red "New" pill (v72), shown while the feature is new to this person. */
export default function NewPill({ id, className = "" }) {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(isNewFeature(id)), [id]);
  if (!show) return null;
  return (
    <span className={`inline-flex items-center rounded-full bg-accent text-white text-[0.5625rem] font-bold uppercase tracking-wide px-1.5 py-0.5 leading-none ${className}`}>
      New
    </span>
  );
}
