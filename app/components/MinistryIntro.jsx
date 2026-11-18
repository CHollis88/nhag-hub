"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Opening a ministry.
//   Fast (its tabs load within ~a quarter second -- the usual case): nothing
//   extra is shown; the ministry just slides in (see .nhag-ministry-enter).
//   Slow (church Wi-Fi, weak signal): this screen appears -- church navy, the
//   ministry's icon (or first letter), its name, a loading bar -- and lifts
//   away as soon as the tabs are ready. Once shown it stays at least ~0.5s so
//   it never flickers, and never more than 4s (the tabs keep loading
//   underneath after that).
const SLOW_AFTER_MS = 250;
const MIN_SHOWN_MS = 500;
const MAX_SHOWN_MS = 4000;
const OUT_MS = 280;

export default function MinistryIntro({ name, imageUrl, ready }) {
  const [phase, setPhase] = useState("waiting"); // waiting -> (shown -> out ->) gone

  useEffect(() => {
    let alive = true;
    let done = false;
    let shownAt = 0;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(() => alive && fn(), ms));
    const finish = () => {
      setPhase("out");
      later(() => setPhase("gone"), OUT_MS);
    };

    Promise.resolve(ready)
      .catch(() => {})
      .then(() => {
        if (!alive || done) return;
        done = true;
        if (!shownAt) setPhase("gone"); // fast: never shown
        else later(finish, Math.max(0, shownAt + MIN_SHOWN_MS - Date.now()));
      });

    later(() => {
      if (done) return;
      shownAt = Date.now();
      setPhase("shown");
      later(() => {
        if (done) return;
        done = true;
        finish();
      }, MAX_SHOWN_MS);
    }, SLOW_AFTER_MS);

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [ready]);

  if (phase === "waiting" || phase === "gone") return null;
  if (typeof document === "undefined") return null;

  // Drawn straight into <body>: inside the ministry's slide-in animation a
  // "fixed" screen is boxed into the ministry's own area (a CSS rule about
  // animated parents), which left a gray strip at the top on phones.
  return createPortal(
    <div
      className={`nhag-welcome nhag-ministry-intro fixed inset-0 z-[70] flex flex-col items-center justify-center p-6 text-center text-white ${phase === "out" ? "is-out" : ""}`}
      role="status"
      aria-label={`Opening ${name}`}
    >
      <div className="nhag-ministry-intro-card flex flex-col items-center">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="nhag-ministry-intro-icon w-24 h-24 rounded-3xl object-cover bg-white" />
        ) : (
          <div
            className="nhag-ministry-intro-icon w-24 h-24 rounded-3xl flex items-center justify-center font-serif text-5xl bg-white text-[#16296B]"
            aria-hidden="true"
          >
            {name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <p className="font-serif text-2xl mt-5 leading-tight max-w-xs break-words">{name}</p>
        <div className="nhag-welcome-bar mt-7" aria-hidden="true" />
      </div>
    </div>,
    document.body
  );
}
