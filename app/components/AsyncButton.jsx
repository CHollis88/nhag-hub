"use client";

import { useEffect, useRef, useState } from "react";

// v71 #38 -- a button for anything that saves or deletes. Three states:
//   idle -> saving -> idle
// While saving it is disabled, says what it's doing ("Saving…"), and a
// second tap is ignored -- including a double-tap in the same instant,
// before React has re-rendered the disabled state (that gap is why a ref
// guards it, not just state).
//
//   <AsyncButton onClick={save} savingLabel="Saving…">Save</AsyncButton>
//
// onClick may be sync or async. It is responsible for its own error
// reporting (toast); a thrown error is logged and the button returns to
// idle so the person can try again.
export default function AsyncButton({
  onClick,
  children,
  savingLabel = "Saving…",
  disabled = false,
  type = "button",
  className = "sp-btn-primary",
  ...rest
}) {
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleClick = async (event) => {
    if (busyRef.current || disabled) {
      event?.preventDefault?.();
      return;
    }
    busyRef.current = true;
    setSaving(true);
    try {
      await onClick?.(event);
    } catch (err) {
      console.error(err);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  return (
    <button
      type={type}
      onClick={type === "submit" && !onClick ? undefined : handleClick}
      disabled={disabled || saving}
      aria-busy={saving || undefined}
      className={`${className} disabled:opacity-60`}
      {...rest}
    >
      {saving ? savingLabel : children}
    </button>
  );
}
