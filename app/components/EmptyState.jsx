"use client";

import { AlertCircle, Lock, SearchX } from "lucide-react";

// v71 #41 -- one component for "there's nothing to show", because there are
// four different reasons and they need different words:
//
//   kind="empty"          no data yet          ("No songs yet.")        [default]
//   kind="no-results"     a search/filter found nothing ("No matches for “grace”.")
//   kind="no-permission"  you can't see this   ("Only leaders can see this.")
//   kind="error"          it failed to load    ("Couldn't load. Try again.")
//
// Old usage -- <EmptyState icon={X} text="..." /> -- still works unchanged.
//
// `action` ({ label, onClick }) renders a button, but ONLY when the person
// is allowed to do it: pass `canAct={canManage}` (or leave it off to
// mean yes). "no-permission" never shows an action, and "error" gets a
// "Try again" button whenever `onRetry` is provided.

const DEFAULTS = {
  empty: { text: "Nothing here yet." },
  "no-results": { text: "No matches found.", icon: SearchX },
  "no-permission": { text: "You don't have access to this.", icon: Lock },
  error: { text: "Couldn't load this. Check your connection and try again.", icon: AlertCircle },
};

export default function EmptyState({ icon, text, kind = "empty", action, canAct = true, onRetry, query }) {
  const fallback = DEFAULTS[kind] || DEFAULTS.empty;
  const Icon = icon || fallback.icon || AlertCircle;
  let message = text || fallback.text;
  if (kind === "no-results" && !text && query) message = `No matches for “${query}”.`;

  const showAction = kind !== "no-permission" && action && canAct !== false;
  const showRetry = kind === "error" && onRetry;

  return (
    <div
      className="flex flex-col items-center text-center py-16 px-4 text-inkfaint"
      role={kind === "error" ? "alert" : undefined}
    >
      <Icon size={28} strokeWidth={1.5} className="opacity-60 mb-2.5" aria-hidden="true" />
      <p className="text-sm">{message}</p>
      {showRetry && (
        <button type="button" onClick={onRetry} className="sp-btn-secondary text-sm mt-4">
          Try again
        </button>
      )}
      {showAction && !showRetry && (
        <button type="button" onClick={action.onClick} className="sp-btn-pill mt-4">
          {action.label}
        </button>
      )}
    </div>
  );
}
