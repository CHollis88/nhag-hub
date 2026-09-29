"use client";

import { useId } from "react";

// v71 #34 -- the control for a STORED on/off setting (Settings, a ministry's
// modules, admin notifications...). Checkboxes stay for picking several items
// from a list; anything that is "this is on or off, and it's saved" is a Switch.
//
// The rule, so it's applied the same way everywhere:
//   Switch    a setting that is saved as it is toggled or lives on a settings
//             screen, and reads naturally as "<name>: On/Off".
//   Checkbox  a choice that goes WITH a form when you press its button ("Notify
//             the group", "Post anonymously"), or an item you pick out of a list
//             of several (who to message, which ministries to block).
//
// It is still a real <input type="checkbox" role="switch">, so screen readers
// say "switch, on/off", Space toggles it, and it works with forms. What's new
// is the look, and that it does not rely on colour alone:
//   * a big touch target (the whole row is tappable, at least 44px tall);
//   * the knob's POSITION and the words "On"/"Off" both show the state;
//   * a visible focus ring, and no sliding animation under reduced motion.
//
//   <Switch checked={on} onChange={(next) => save(next)} label="Push notifications"
//           description="Turn this on once per device." disabled={busy} />
//
// `onChange` receives the NEW value (true/false), not the event. `busy` is for
// a save in flight: the switch is disabled and says so, and the caller decides
// whether to show the new value optimistically (and roll back on failure).
export default function Switch({ checked, onChange, label, description, describedBy, disabled = false, busy = false, id, className = "" }) {
  const autoId = useId();
  const inputId = id || `sw-${autoId}`;
  const descId = description ? `${inputId}-desc` : undefined;
  const describedByIds = [descId, describedBy].filter(Boolean).join(" ") || undefined;
  const on = Boolean(checked);

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className={`flex items-center justify-between gap-3 min-h-[44px] py-1 ${disabled || busy ? "opacity-60" : "cursor-pointer"}`}
      >
        <span className="text-sm text-inksoft min-w-0">{label}</span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-semibold text-inkfaint w-7 text-right" aria-hidden="true">
            {busy ? "…" : on ? "On" : "Off"}
          </span>
          <input
            id={inputId}
            type="checkbox"
            role="switch"
            checked={on}
            disabled={disabled || busy}
            aria-checked={on}
            aria-describedby={describedByIds}
            aria-busy={busy || undefined}
            onChange={(e) => {
              // Belt and braces: a disabled/busy switch never calls back, even
              // if something (assistive tech, a script) clicks it anyway.
              if (disabled || busy) return;
              onChange?.(e.target.checked);
            }}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={`relative inline-block w-11 h-6 rounded-full border transition-colors motion-reduce:transition-none
              peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-accent
              ${on ? "bg-sage border-sage" : "bg-line border-line"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none
                ${on ? "translate-x-5" : "translate-x-0"}`}
            />
          </span>
        </span>
      </label>
      {description && (
        <p id={descId} className="text-xs text-inkfaint mt-0 mb-2">
          {description}
        </p>
      )}
    </div>
  );
}
